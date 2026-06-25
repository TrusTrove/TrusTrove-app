import {
  Contract,
  rpc,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  xdr,
  scValToNative,
} from '@stellar/stellar-sdk';
import { signTransaction } from '@stellar/freighter-api';
import { getConfig, getSorobanServer } from './config.js';

const MAX_TRANSACTION_POLL_ATTEMPTS = 30;

export class TransactionTimeoutError extends Error {
  readonly txHash: string;

  constructor(txHash: string) {
    super(`Transaction confirmation timed out for hash: ${txHash}`);
    this.name = 'TransactionTimeoutError';
    this.txHash = txHash;
  }
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const msg = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('timeout') ||
    msg.includes('abort') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('econnreset') ||
    msg.includes('eai_again') ||
    msg.includes('etimedout')
  );
}

interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isNetworkError(err) || attempt === maxAttempts) {
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(
        `[SDK] RPC call failed (attempt ${attempt}/${maxAttempts}): ${err instanceof Error ? err.message : String(err)}. Retrying in ${delay}ms...`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export class BaseContractClient {
  protected contractId: string;

  constructor(contractId: string) {
    if (!contractId) {
      throw new Error('Contract ID is required');
    }
    this.contractId = contractId;
  }

  protected get contract(): Contract {
    return new Contract(this.contractId);
  }

  protected async readContract<T>(
    method: string,
    args: xdr.ScVal[],
    publicKey: string,
    parse: (val: xdr.ScVal) => T
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
      throw new Error(`Simulation failed for ${method}: ${sim.error}`);
    }

    const resultVal = (sim as rpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    if (!resultVal) {
      throw new Error(`No return value from simulation for ${method}`);
    }

    return parse(resultVal);
  }

  protected async writeContract(
    method: string,
    args: xdr.ScVal[],
    publicKey: string
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
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed for ${method}: ${sim.error}`);
    }

    const prepared = await withRetry(() => server.prepareTransaction(tx));
    const signed = await signTransaction(prepared.toXDR(), {
      network: config.networkPassphrase === Networks.PUBLIC ? 'PUBLIC' : 'TESTNET',
      networkPassphrase: config.networkPassphrase,
      accountToSign: publicKey,
    });

    const result = await withRetry(() =>
      server.sendTransaction(
        TransactionBuilder.fromXDR(signed, config.networkPassphrase)
      )
    );

    if (result.status === 'ERROR') {
      throw new Error(`Send failed for ${method}: ${result.errorResult?.toXDR()}`);
    }

    let response = await withRetry(() => server.getTransaction(result.hash));
    let attempts = 1;
    while (
      response.status === rpc.Api.GetTransactionStatus.NOT_FOUND &&
      attempts < MAX_TRANSACTION_POLL_ATTEMPTS
    ) {
      await new Promise(r => setTimeout(r, 1000));
      response = await withRetry(() => server.getTransaction(result.hash));
      attempts++;
    }

    if (response.status === rpc.Api.GetTransactionStatus.NOT_FOUND) {
      throw new TransactionTimeoutError(result.hash);
    }

    if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed on-chain for ${method}`);
    }

    return result.hash;
  }

  public async simulateTransaction(
    method: string,
    args: xdr.ScVal[],
    publicKey: string
  ): Promise<{
    estimatedFeeXlm: string;
    functionName: string;
    expectedResult: any;
    footprintSize: number;
  }> {
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
      throw new Error(sim.error || 'Simulation failed');
    }

    const footprintSize = sim.transactionData
      ? (sim.transactionData.getReadOnly().length + sim.transactionData.getReadWrite().length)
      : 0;

    const retval = sim.result?.retval;
    let expectedResult: any = undefined;
    if (retval) {
      try {
        expectedResult = scValToNative(retval);
      } catch (e) {
        expectedResult = retval;
      }
    }

    const totalStroops = BigInt(BASE_FEE) + BigInt(sim.minResourceFee || '0');
    const estimatedFeeXlm = (Number(totalStroops) / 10_000_000).toFixed(7);

    return {
      estimatedFeeXlm,
      functionName: method,
      expectedResult,
      footprintSize,
    };
  }
}
