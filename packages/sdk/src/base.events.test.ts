import { describe, expect, it } from "vitest";
import { rpc, xdr, StrKey } from "@stellar/stellar-sdk";
import { parseContractEvents, parseSorobanEvents } from "./base.js";

function makeContractEvent(name: string): xdr.ContractEvent {
  return {
    contractId: () => Buffer.alloc(32, 1),
    body: () => ({
      v0: () => ({
        topics: () => [xdr.ScVal.scvSymbol(name)],
        data: () => xdr.ScVal.scvU32(7),
      }),
    }),
  } as unknown as xdr.ContractEvent;
}

function makeSuccessfulResult(
  events: xdr.ContractEvent[],
): rpc.Api.GetSuccessfulTransactionResponse {
  return {
    status: rpc.Api.GetTransactionStatus.SUCCESS,
    resultMetaXdr: {
      v3: () => ({
        sorobanMeta: () => ({ events: () => events }),
      }),
    },
  } as unknown as rpc.Api.GetSuccessfulTransactionResponse;
}

describe("parseContractEvents", () => {
  it("parses event topics and data with contract provenance and raw XDR", () => {
    const raw = makeContractEvent("create");

    expect(parseContractEvents(makeSuccessfulResult([raw]))).toEqual([
      {
        contractId: StrKey.encodeContract(Buffer.alloc(32, 1)),
        type: "create",
        topics: ["create"],
        data: 7,
        raw,
      },
    ]);
  });

  it("preserves unknown event names and returns an empty list when there are no events", () => {
    const event = makeContractEvent("future_event");
    const result = makeSuccessfulResult([event]);

    expect(parseSorobanEvents(result)[0]).toMatchObject({
      type: "future_event",
      raw: event,
    });

    const emptyResult = {
      ...result,
      resultMetaXdr: { v3: () => undefined },
    } as unknown as rpc.Api.GetSuccessfulTransactionResponse;
    expect(parseContractEvents(emptyResult)).toEqual([]);
  });

  it("rejects failed transactions instead of returning success-shaped empty data", () => {
    const result = {
      status: rpc.Api.GetTransactionStatus.FAILED,
    } as rpc.Api.GetTransactionResponse;

    expect(() => parseContractEvents(result)).toThrow(
      "Cannot parse contract events from transaction with status FAILED",
    );
  });
});
