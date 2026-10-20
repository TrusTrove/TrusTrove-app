import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BaseContractClient,
  SimulationError,
  MissingReturnValueError,
  TransactionSendError,
  TransactionFailedError,
  TransactionTimeoutError,
  TransactionTryAgainLaterError,
} from "./base.js";
import * as config from "./config.js";
import { rpc, xdr, Networks, scValToNative } from "@stellar/stellar-sdk";
import * as freighter from "@stellar/freighter-api";

vi.mock("./config.js");
vi.mock("@stellar/freighter-api");
vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@stellar/stellar-sdk")>();
  class MockTransactionBuilder extends actual.TransactionBuilder {}
  MockTransactionBuilder.fromXDR = vi.fn().mockReturnValue("mock-tx") as any;
  return {
    ...actual,
    TransactionBuilder: MockTransactionBuilder,
    scValToNative: vi.fn((val: any) => actual.scValToNative(val)),
  };
});

class TestClient extends BaseContractClient {
  public testReadContract(
    method: string,
    args: xdr.ScVal[],
    publicKey: string,
    parse: (val: xdr.ScVal) => any,
  ) {
    return this.readContract(method, args, publicKey, parse);
  }

  public testWriteContract(
    method: string,
    args: xdr.ScVal[],
    publicKey: string,
  ) {
    return this.writeContract(method, args, publicKey);
  }
}

describe("BaseContractClient", () => {
  let client: TestClient;
  let mockServer: any;

  beforeEach(() => {
    client = new TestClient(
      "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    );

    mockServer = {
      getAccount: vi.fn().mockResolvedValue({
        accountId: () =>
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        sequenceNumber: () => "1",
        incrementSequenceNumber: vi.fn(),
      }),
      simulateTransaction: vi.fn(),
      prepareTransaction: vi.fn().mockResolvedValue({
        toXDR: vi.fn().mockReturnValue("mock-xdr"),
      }),
      sendTransaction: vi.fn(),
      getTransaction: vi.fn(),
    };

    vi.mocked(config.getConfig).mockReturnValue({
      networkPassphrase: Networks.TESTNET,
      horizonUrl: "https://horizon-testnet.stellar.org",
      sorobanRpcUrl: "https://soroban-testnet.stellar.org",
      contractIds: {
        registry: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        invoice: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        pool: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        escrow: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        agentRegistry:
          "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
      },
      usdc: {
        issuer: "GBUSDC",
        assetCode: "USDC",
      },
    });

    vi.mocked(config.getSorobanServer).mockReturnValue(
      mockServer as unknown as rpc.Server,
    );
    vi.mocked(freighter.signTransaction).mockResolvedValue("signed-xdr");
  });

  describe("readContract", () => {
    it("successfully reads a contract", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: {
          retval: xdr.ScVal.scvU32(42),
        },
      });

      const result = await client.testReadContract(
        "test_method",
        [],
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        (val) => val.u32(),
      );

      expect(result).toBe(42);
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(1);
    });

    it("handles simulation errors", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        error: "Simulation failed",
      });

      await expect(
        client.testReadContract(
          "test_method",
          [],
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
          (val) => val.u32(),
        ),
      ).rejects.toBeInstanceOf(SimulationError);
    });

    it("throws MissingReturnValueError when simulation returns no value", async () => {
      mockServer.simulateTransaction.mockResolvedValue({ result: {} });

      await expect(
        client.testReadContract(
          "test_method",
          [],
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
          (val) => val.u32(),
        ),
      ).rejects.toBeInstanceOf(MissingReturnValueError);
    });
  });

  describe("writeContract", () => {
    it("successfully writes to a contract", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: { retval: xdr.ScVal.scvVoid() },
        transactionData: {
          getReadOnly: () => [],
          getReadWrite: () => [],
        },
        minResourceFee: "100",
      });

      mockServer.sendTransaction.mockResolvedValue({
        status: "PENDING",
        hash: "mock-hash",
      });

      mockServer.getTransaction.mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
      });

      const hash = await client.testWriteContract(
        "test_method",
        [],
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(hash).toBe("mock-hash");
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(1);
      expect(mockServer.prepareTransaction).toHaveBeenCalledTimes(1);
      expect(freighter.signTransaction).toHaveBeenCalledTimes(1);
      expect(mockServer.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it("broadcasts a mutating call once on a network error while reads still retry", async () => {
      // getAccount and simulateTransaction are side-effect-free, so withRetry
      // keeps trying them. A lost send response must NOT be re-broadcast.
      mockServer.getAccount
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockRejectedValueOnce(new TypeError("fetch failed"));
      mockServer.simulateTransaction
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValue({
          result: { retval: xdr.ScVal.scvVoid() },
          transactionData: {
            getReadOnly: () => [],
            getReadWrite: () => [],
          },
          minResourceFee: "100",
        });
      mockServer.sendTransaction.mockRejectedValue(
        new TypeError("fetch failed"),
      );

      vi.useFakeTimers();
      const settled = client
        .testWriteContract(
          "test_method",
          [],
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        )
        .catch((err) => err);

      for (let i = 0; i < 12; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      const err = await settled;
      vi.useRealTimers();

      expect(err).toBeInstanceOf(TypeError);
      expect(mockServer.getAccount).toHaveBeenCalledTimes(3);
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(2);
      expect(mockServer.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it("treats a DUPLICATE submission of the same hash as success", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: { retval: xdr.ScVal.scvVoid() },
        transactionData: {
          getReadOnly: () => [],
          getReadWrite: () => [],
        },
        minResourceFee: "100",
      });
      mockServer.sendTransaction.mockResolvedValue({
        status: "DUPLICATE",
        hash: "mock-hash",
      });
      mockServer.getTransaction.mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
      });

      const hash = await client.testWriteContract(
        "test_method",
        [],
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(hash).toBe("mock-hash");
      expect(mockServer.sendTransaction).toHaveBeenCalledTimes(1);
    });

    it("re-broadcasts the same transaction after TRY_AGAIN_LATER", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: { retval: xdr.ScVal.scvVoid() },
        transactionData: {
          getReadOnly: () => [],
          getReadWrite: () => [],
        },
        minResourceFee: "100",
      });
      mockServer.sendTransaction
        .mockResolvedValueOnce({ status: "TRY_AGAIN_LATER", hash: "mock-hash" })
        .mockResolvedValue({ status: "PENDING", hash: "mock-hash" });
      mockServer.getTransaction.mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.SUCCESS,
      });

      vi.useFakeTimers();
      const settled = client.testWriteContract(
        "test_method",
        [],
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      const hash = await settled;
      vi.useRealTimers();

      expect(hash).toBe("mock-hash");
      expect(mockServer.sendTransaction).toHaveBeenCalledTimes(2);
    });

    it("throws TransactionTryAgainLaterError carrying the hash once attempts run out", async () => {
      const limited = new TestClient(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        { maxAttempts: 2, baseDelayMs: 10 },
      );

      mockServer.simulateTransaction.mockResolvedValue({
        result: { retval: xdr.ScVal.scvVoid() },
        transactionData: {
          getReadOnly: () => [],
          getReadWrite: () => [],
        },
        minResourceFee: "100",
      });
      mockServer.sendTransaction.mockResolvedValue({
        status: "TRY_AGAIN_LATER",
        hash: "mock-hash",
      });

      vi.useFakeTimers();
      const settled = limited
        .testWriteContract(
          "test_method",
          [],
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        )
        .catch((err) => err);

      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      const err = await settled;
      vi.useRealTimers();

      expect(err).toBeInstanceOf(TransactionTryAgainLaterError);
      expect(err.txHash).toBe("mock-hash");
      expect(err.attempts).toBe(2);
      expect(mockServer.sendTransaction).toHaveBeenCalledTimes(2);
    });

    it("defaults the mutating-call retry policy and accepts an override", () => {
      expect(client.mutationRetryPolicy).toEqual({
        maxAttempts: 3,
        baseDelayMs: 1000,
      });

      const tuned = new TestClient(
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        { maxAttempts: 1 },
      );
      expect(tuned.mutationRetryPolicy).toEqual({
        maxAttempts: 1,
        baseDelayMs: 1000,
      });
    });

    it("handles transaction timeout error", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: { retval: xdr.ScVal.scvVoid() },
        transactionData: {
          getReadOnly: () => [],
          getReadWrite: () => [],
        },
        minResourceFee: "100",
      });

      mockServer.sendTransaction.mockResolvedValue({
        status: "PENDING",
        hash: "mock-hash",
      });

      mockServer.getTransaction.mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.NOT_FOUND,
      });

      // To avoid actually waiting 30 seconds in tests, we could mock the retry delay
      // But testing timeout logic directly is fine too
      // However to not block the whole test run we will just simulate it
      vi.useFakeTimers();

      const promise = expect(
        client.testWriteContract(
          "test_method",
          [],
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        ),
      ).rejects.toThrow(TransactionTimeoutError);

      for (let i = 0; i < 35; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      await promise;

      vi.useRealTimers();
    });

    it("throws SimulationError when the write simulation fails", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        error: "write simulation failed",
      });

      await expect(
        client.testWriteContract(
          "test_method",
          [],
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        ),
      ).rejects.toBeInstanceOf(SimulationError);
    });

    it("throws TransactionSendError when the RPC rejects the send", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: { retval: xdr.ScVal.scvVoid() },
        transactionData: {
          getReadOnly: () => [],
          getReadWrite: () => [],
        },
        minResourceFee: "100",
      });

      mockServer.sendTransaction.mockResolvedValue({
        status: "ERROR",
        hash: "mock-hash",
        errorResult: { toXDR: () => "AAAA//..." },
      });

      await expect(
        client.testWriteContract(
          "test_method",
          [],
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        ),
      ).rejects.toBeInstanceOf(TransactionSendError);
    });

    it("throws TransactionFailedError when the transaction fails on-chain", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: { retval: xdr.ScVal.scvVoid() },
        transactionData: {
          getReadOnly: () => [],
          getReadWrite: () => [],
        },
        minResourceFee: "100",
      });

      mockServer.sendTransaction.mockResolvedValue({
        status: "PENDING",
        hash: "mock-hash",
      });

      mockServer.getTransaction.mockResolvedValue({
        status: rpc.Api.GetTransactionStatus.FAILED,
      });

      await expect(
        client.testWriteContract(
          "test_method",
          [],
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        ),
      ).rejects.toBeInstanceOf(TransactionFailedError);
    });
  });

  describe("simulateTransaction", () => {
    it("returns the expected fee, footprint, and decoded result", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: { retval: xdr.ScVal.scvU32(7) },
        transactionData: {
          getReadOnly: () => Array.from({ length: 2 }),
          getReadWrite: () => Array.from({ length: 1 }),
        },
        minResourceFee: "100",
      });

      const result = await client.simulateTransaction(
        "test_method",
        [],
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result.functionName).toBe("test_method");
      expect(result.expectedResult).toBe(7);
      expect(result.footprintSize).toBe(3);
      // BASE_FEE (100) + minResourceFee (100) = 200 stroops => 0.00002 XLM
      expect(result.estimatedFeeXlm).toBe("0.0000200");
    });

    it("falls back to the raw ScVal when scValToNative cannot decode the result", async () => {
      vi.mocked(scValToNative).mockImplementationOnce(() => {
        throw new Error("unsupported scval");
      });
      const retval = xdr.ScVal.scvU32(9);
      mockServer.simulateTransaction.mockResolvedValue({
        result: { retval },
        transactionData: {
          getReadOnly: () => [],
          getReadWrite: () => [],
        },
        minResourceFee: "0",
      });

      const result = await client.simulateTransaction(
        "test_method",
        [],
        "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
      );

      expect(result.expectedResult).toBe(retval);
      expect(result.footprintSize).toBe(0);
    });

    it("throws SimulationError when the simulation fails", async () => {
      mockServer.simulateTransaction.mockResolvedValue({
        error: "simulation rejected",
      });

      await expect(
        client.simulateTransaction(
          "test_method",
          [],
          "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB",
        ),
      ).rejects.toBeInstanceOf(SimulationError);
    });
  });

  describe("withRetry around the RPC calls", () => {
    const ACCOUNT = "GACR43ILX6H4PGAOO5QKSZLU4ZJMGT3E66EAUDPLM5J6YTP4Y3PSHWGB";

    const read = () =>
      client.testReadContract("test_method", [], ACCOUNT, (val) => val.u32());

    beforeEach(() => {
      mockServer.simulateTransaction.mockResolvedValue({
        result: { retval: xdr.ScVal.scvU32(42) },
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("retries getAccount once on a network error and then succeeds", async () => {
      vi.useFakeTimers();
      mockServer.getAccount.mockRejectedValueOnce(
        new TypeError("fetch failed"),
      );

      const promise = read();
      await vi.advanceTimersByTimeAsync(1_000);

      await expect(promise).resolves.toBe(42);
      expect(mockServer.getAccount).toHaveBeenCalledTimes(2);
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(1);
    });

    it("waits baseDelay * 2^(attempt-1) between retries and stops at maxAttempts", async () => {
      vi.useFakeTimers();
      mockServer.getAccount.mockRejectedValue(new Error("network timeout"));

      const promise = expect(read()).rejects.toThrow("network timeout");

      // attempt 1 fails, schedules a 1_000 ms delay
      await vi.advanceTimersByTimeAsync(999);
      expect(mockServer.getAccount).toHaveBeenCalledTimes(1);

      // attempt 2 fails after the first delay, schedules 2_000 ms
      await vi.advanceTimersByTimeAsync(1);
      expect(mockServer.getAccount).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1_999);
      expect(mockServer.getAccount).toHaveBeenCalledTimes(2);

      // attempt 3 is the last one: it fails and the error surfaces
      await vi.advanceTimersByTimeAsync(1);
      expect(mockServer.getAccount).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockServer.getAccount).toHaveBeenCalledTimes(3);

      await promise;
    });

    it("does not retry an error that is not a network failure", async () => {
      mockServer.getAccount.mockRejectedValue(
        new Error("Account not found on ledger"),
      );

      await expect(read()).rejects.toThrow("Account not found on ledger");
      expect(mockServer.getAccount).toHaveBeenCalledTimes(1);
      expect(mockServer.simulateTransaction).not.toHaveBeenCalled();
    });

    it("treats a rejected simulation result as non-retryable", async () => {
      mockServer.simulateTransaction.mockRejectedValue(
        new Error("bad request payload"),
      );

      await expect(read()).rejects.toThrow("bad request payload");
      expect(mockServer.getAccount).toHaveBeenCalledTimes(1);
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(1);
    });

    it("retries the simulation call itself before building the transaction", async () => {
      vi.useFakeTimers();
      mockServer.simulateTransaction
        .mockRejectedValueOnce(new Error("socket hang up: etimedout"))
        .mockResolvedValue({ result: { retval: xdr.ScVal.scvU32(42) } });

      const promise = read();
      await vi.advanceTimersByTimeAsync(1_000);

      await expect(promise).resolves.toBe(42);
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(2);
    });
  });
});
