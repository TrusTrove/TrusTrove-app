import {
  Contract,
  FeeBumpTransaction,
  rpc,
  Transaction,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  scValToNative,
} from "@stellar/stellar-sdk";
import * as freighterApi from "@stellar/freighter-api";
import { getConfig, getSorobanServer } from "./config.js";

const signTransactionFn =
  (
    freighterApi as unknown as {
      signTransaction?: (
        transactionXdr: string,
        opts?: {
          network?: string;
          networkPassphrase?: string;
          accountToSign?: string;
        },
      ) => Promise<string>;
      default?: {
        signTransaction?: (
          transactionXdr: string,
          opts?: {
            network?: string;
            networkPassphrase?: string;
            accountToSign?: string;
          },
        ) => Promise<string>;
      };
    }
  ).signTransaction ||
  (
    freighterApi as unknown as {
      default?: {
        signTransaction?: (
          transactionXdr: string,
          opts?: {
            network?: string;
            networkPassphrase?: string;
            accountToSign?: string;
          },
        ) => Promise<string>;
      };
    }
  ).default?.signTransaction;

if (!signTransactionFn) {
  throw new Error(
    "The installed @stellar/freighter-api package does not expose signTransaction",
  );
}

const signTransactionCompat = signTransactionFn as (
  transactionXdr: string,
  opts?: {
    network?: string;
    networkPassphrase?: string;
    accountToSign?: string;
  },
) => Promise<string>;

const MAX_TRANSACTION_POLL_ATTEMPTS = 30;

export class TransactionTimeoutError extends Error {
  readonly txHash: string;

  constructor(txHash: string) {
    super(`Transaction confirmation timed out for hash: ${txHash}`);
    this.name = "TransactionTimeoutError";
    this.txHash = txHash;
  }
}

/**
 * Thrown when a contract method simulation is rejected by the Soroban RPC
 * before anything is signed or submitted.
 */
export class SimulationError extends Error {
  /** Contract method whose simulation failed. */
  readonly method: string;
  /** Underlying Soroban error message, when the RPC returned one. */
  readonly cause?: string;

  constructor(method: string, message?: string) {
    super(
      message
        ? `Simulation failed for ${method}: ${message}`
        : `Simulation failed for ${method}`,
    );
    this.name = "SimulationError";
    this.method = method;
    if (message) this.cause = message;
  }
}

/**
 * Thrown when a simulation succeeds but returns no result value for the
 * contract method.
 */
export class MissingReturnValueError extends Error {
  /** Contract method that produced no return value. */
  readonly method: string;

  constructor(method: string) {
    super(`No return value from simulation for ${method}`);
    this.name = "MissingReturnValueError";
    this.method = method;
  }
}

/**
 * Thrown when the signed transaction is rejected at submission time by the
 * Soroban RPC.
 */
export class TransactionSendError extends Error {
  /** Contract method whose transaction was rejected on send. */
  readonly method: string;
  /** Underlying Soroban error result, when the RPC returned one. */
  readonly sorobanError?: string;

  constructor(method: string, sorobanError?: string) {
    super(
      sorobanError
        ? `Send failed for ${method}: ${sorobanError}`
        : `Send failed for ${method}`,
    );
    this.name = "TransactionSendError";
    this.method = method;
    if (sorobanError) this.sorobanError = sorobanError;
  }
}

/**
 * Thrown when a submitted transaction is confirmed on-chain as FAILED.
 */
export class TransactionFailedError extends Error {
  /** Contract method whose transaction failed on-chain. */
  readonly method: string;

  constructor(method: string) {
    super(`Transaction failed on-chain for ${method}`);
    this.name = "TransactionFailedError";
    this.method = method;
  }
}

/**
 * How a mutating call re-broadcasts an already-signed transaction.
 *
 * Reads and simulations are retried on any network-shaped error because they
 * carry no side effects. Broadcasting is different: if the RPC accepted the
 * transaction and only the response was lost, retrying re-submits the same
 * signed XDR — a double funding/repayment, or a confusing `tx_bad_seq`. So a
 * transport error is never retried here. Only an explicit `TRY_AGAIN_LATER`
 * is, because the RPC defines that status as having not queued the transaction.
 */
export interface MutationRetryPolicy {
  /** Total broadcast attempts, including the first. Values below 1 mean one. */
  maxAttempts: number;
  /** Backoff before the next attempt, in ms, doubling from this base. */
  baseDelayMs: number;
}

const DEFAULT_MUTATION_RETRY_POLICY: MutationRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
};

/**
 * Thrown when every broadcast attempt allowed by the `MutationRetryPolicy` was
 * answered with `TRY_AGAIN_LATER`, i.e. the RPC stayed congested.
 */
export class TransactionTryAgainLaterError extends Error {
  /** Contract method whose transaction was refused. */
  readonly method: string;
  /** Hash of the transaction that was never queued, so it is safe to re-submit. */
  readonly txHash: string;
  /** Broadcast attempts made before giving up. */
  readonly attempts: number;

  constructor(method: string, txHash: string, attempts: number) {
    super(
      `Send refused as TRY_AGAIN_LATER for ${method} after ${attempts} attempt(s): ${txHash}`,
    );
    this.name = "TransactionTryAgainLaterError";
    this.method = method;
    this.txHash = txHash;
    this.attempts = attempts;
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    msg.includes("fetch") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("abort") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("econnreset") ||
    msg.includes("eai_again") ||
    msg.includes("etimedout")
  );
}

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isNetworkError(err) || attempt === maxAttempts) throw err;
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * Math.pow(2, attempt - 1)),
      );
    }
  }

  throw lastError;
}

/**
 * Result type returned by transaction simulations.
 */
export interface SimulationResult {
  /** Estimated fee in XLM (formatted to 7 decimal places) */
  estimatedFeeXlm: string;
  /** Name of the contract method being simulated */
  functionName: string;
  /** Decoded return value from the simulation, or undefined if none */
  expectedResult: unknown;
  /** Number of ledger entries accessed (read-only + read-write) */
  footprintSize: number;
}

export class BaseContractClient {
  protected contractId: string;
  private contractInstance: Contract;
  /** Broadcast policy for this client's mutating calls. */
  readonly mutationRetryPolicy: MutationRetryPolicy;

  constructor(
    contractId: string,
    mutationRetryPolicy: Partial<MutationRetryPolicy> = {},
  ) {
    if (!contractId) throw new Error("Contract ID is required");
    this.contractId = contractId;
    this.contractInstance = new Contract(contractId);
    this.mutationRetryPolicy = {
      ...DEFAULT_MUTATION_RETRY_POLICY,
      ...mutationRetryPolicy,
    };
  }

  protected get contract(): Contract {
    return this.contractInstance;
  }

  protected async readContract<T>(
    method: string,
    args: xdr.ScVal[],
    publicKey: string,
    parse: (val: xdr.ScVal) => T,
  ): Promise<T> {
    const config = getConfig();
    const server = getSorobanServer();
    const account = await withRetry(() => server.getAccount(publicKey));
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await withRetry(() => server.simulateTransaction(tx));
    if (rpc.Api.isSimulationError(sim)) {
      throw new SimulationError(method, sim.error);
    }
    const resultVal = (sim as rpc.Api.SimulateTransactionSuccessResponse).result
      ?.retval;
    if (!resultVal) throw new MissingReturnValueError(method);
    return parse(resultVal);
  }

  protected async writeContract(
    method: string,
    args: xdr.ScVal[],
    publicKey: string,
  ): Promise<string> {
    const config = getConfig();
    const server = getSorobanServer();
    const account = await withRetry(() => server.getAccount(publicKey));
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await withRetry(() => server.simulateTransaction(tx));
    if (rpc.Api.isSimulationError(sim))
      throw new SimulationError(method, sim.error);
    const prepared = await withRetry(() => server.prepareTransaction(tx));
    const signed = await signTransactionCompat(prepared.toXDR(), {
      network:
        config.networkPassphrase === Networks.PUBLIC ? "PUBLIC" : "TESTNET",
      networkPassphrase: config.networkPassphrase,
      accountToSign: publicKey,
    });
    const result = await this.broadcast(
      method,
      server,
      TransactionBuilder.fromXDR(signed, config.networkPassphrase),
    );
    let response = await withRetry(() => server.getTransaction(result.hash));
    let attempts = 1;
    while (
      response.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < MAX_TRANSACTION_POLL_ATTEMPTS
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      response = await withRetry(() => server.getTransaction(result.hash));
      attempts++;
    }
    if (response.status === rpc.Api.GetTransactionStatus.NOT_FOUND)
      throw new TransactionTimeoutError(result.hash);
    if (response.status === rpc.Api.GetTransactionStatus.FAILED)
      throw new TransactionFailedError(method);
    return result.hash;
  }

  /**
   * Broadcasts an already-signed mutating transaction.
   *
   * `PENDING` and `DUPLICATE` both return normally: a duplicate means the RPC
   * already holds this exact transaction, so the caller resolves it by polling
   * the hash instead of reporting a second submission as a failure. `ERROR`
   * throws `TransactionSendError`. `TRY_AGAIN_LATER` — which the RPC defines as
   * not having queued the transaction — is re-broadcast with exponential
   * backoff until `MutationRetryPolicy.maxAttempts` is exhausted.
   *
   * Deliberately not wrapped in `withRetry`: a transport error can follow a
   * send the RPC already accepted, and re-submitting the same XDR would risk a
   * duplicate funding or repayment. Such errors propagate to the caller.
   */
  private async broadcast(
    method: string,
    server: rpc.Server,
    tx: Transaction | FeeBumpTransaction,
  ): Promise<rpc.Api.SendTransactionResponse> {
    // A policy of 0 would make the loop below never broadcast at all.
    const maxAttempts = Math.max(1, this.mutationRetryPolicy.maxAttempts);
    const { baseDelayMs } = this.mutationRetryPolicy;
    let lastRefusedHash = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const result = await server.sendTransaction(tx);
      if (result.status !== "TRY_AGAIN_LATER") {
        if (result.status === "ERROR")
          throw new TransactionSendError(
            method,
            result.errorResult?.toXDR().toString("base64"),
          );
        return result;
      }
      lastRefusedHash = result.hash;
      if (attempt < maxAttempts)
        await new Promise((resolve) =>
          setTimeout(resolve, baseDelayMs * Math.pow(2, attempt - 1)),
        );
    }
    throw new TransactionTryAgainLaterError(
      method,
      lastRefusedHash,
      maxAttempts,
    );
  }

  public async simulateTransaction(
    method: string,
    args: xdr.ScVal[],
    publicKey: string,
  ): Promise<SimulationResult> {
    const config = getConfig();
    const server = getSorobanServer();
    const account = await withRetry(() => server.getAccount(publicKey));
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: config.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();
    const sim = await withRetry(() => server.simulateTransaction(tx));
    if (rpc.Api.isSimulationError(sim))
      throw new SimulationError(method, sim.error);
    const footprintSize = sim.transactionData
      ? sim.transactionData.getReadOnly().length +
        sim.transactionData.getReadWrite().length
      : 0;
    const retval = sim.result?.retval;
    let expectedResult: unknown = undefined;
    if (retval) {
      try {
        expectedResult = scValToNative(retval);
      } catch {
        expectedResult = retval;
      }
    }
    const totalStroops = BigInt(BASE_FEE) + BigInt(sim.minResourceFee || "0");
    return {
      estimatedFeeXlm: (Number(totalStroops) / 10_000_000).toFixed(7),
      functionName: method,
      expectedResult,
      footprintSize,
    };
  }
}
