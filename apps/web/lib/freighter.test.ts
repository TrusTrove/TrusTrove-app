import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isFreighterInstalled,
  connectFreighter,
  getFreighterPublicKey,
  watchFreighterChanges,
  FreighterError,
} from "./freighter";

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getPublicKey: vi.fn(),
  getNetworkDetails: vi.fn(),
}));

import {
  isConnected,
  requestAccess,
  getPublicKey,
  getNetworkDetails,
} from "@stellar/freighter-api";

const mockIsConnected = vi.mocked(isConnected);
const mockRequestAccess = vi.mocked(requestAccess);
const mockGetPublicKey = vi.mocked(getPublicKey);
const mockGetNetworkDetails = vi.mocked(getNetworkDetails);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("FreighterError", () => {
  it("has code and message", () => {
    const err = new FreighterError(
      "user_rejected",
      "The user rejected this request.",
    );
    expect(err.code).toBe("user_rejected");
    expect(err.message).toBe("The user rejected this request.");
    expect(err.name).toBe("FreighterError");
  });
});

describe("isFreighterInstalled", () => {
  it("returns true when connected", async () => {
    mockIsConnected.mockResolvedValue(true);
    expect(await isFreighterInstalled()).toBe(true);
  });

  it("returns false when not connected", async () => {
    mockIsConnected.mockResolvedValue(false);
    expect(await isFreighterInstalled()).toBe(false);
  });

  it("returns false on error", async () => {
    mockIsConnected.mockRejectedValue(new Error("Extension not found"));
    expect(await isFreighterInstalled()).toBe(false);
  });
});

describe("connectFreighter", () => {
  it("returns the public key on success", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockRequestAccess.mockResolvedValue("G12345");

    const result = await connectFreighter();
    expect(result).toBe("G12345");
  });

  it("throws FreighterError with not_installed when Freighter is not installed", async () => {
    mockIsConnected.mockResolvedValue(false);

    await expect(connectFreighter()).rejects.toThrow(FreighterError);
    try {
      await connectFreighter();
    } catch (err) {
      expect(err).toBeInstanceOf(FreighterError);
      expect((err as FreighterError).code).toBe("not_installed");
    }
  });

  it("throws FreighterError with user_rejected when user rejects", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockRequestAccess.mockRejectedValue(
      new Error("The user rejected this request."),
    );

    await expect(connectFreighter()).rejects.toThrow(FreighterError);
    try {
      await connectFreighter();
    } catch (err) {
      expect(err).toBeInstanceOf(FreighterError);
      expect((err as FreighterError).code).toBe("user_rejected");
    }
  });

  it("throws FreighterError with not_installed when Freighter returns internal error", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockRequestAccess.mockRejectedValue(
      new Error("The wallet encountered an internal error"),
    );

    await expect(connectFreighter()).rejects.toThrow(FreighterError);
    try {
      await connectFreighter();
    } catch (err) {
      expect(err).toBeInstanceOf(FreighterError);
      expect((err as FreighterError).code).toBe("not_installed");
    }
  });

  it("throws FreighterError with unknown for unexpected errors", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockRequestAccess.mockRejectedValue(new Error("Something unexpected"));

    await expect(connectFreighter()).rejects.toThrow(FreighterError);
    try {
      await connectFreighter();
    } catch (err) {
      expect(err).toBeInstanceOf(FreighterError);
      expect((err as FreighterError).code).toBe("unknown");
    }
  });

  it("throws FreighterError with unknown for non-Error rejections", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockRequestAccess.mockRejectedValue("random string error");

    await expect(connectFreighter()).rejects.toThrow(FreighterError);
    try {
      await connectFreighter();
    } catch (err) {
      expect(err).toBeInstanceOf(FreighterError);
      expect((err as FreighterError).code).toBe("unknown");
    }
  });
});

describe("watchFreighterChanges", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setFreighterState = (address: string, network: string) => {
    mockGetPublicKey.mockResolvedValue(address);
    mockGetNetworkDetails.mockResolvedValue({ network } as any);
  };

  it("does not report anything while Freighter matches the baseline", async () => {
    setFreighterState("G12345", "TESTNET");
    const onChange = vi.fn();

    const stop = watchFreighterChanges(
      { address: "G12345", network: "testnet" },
      onChange,
      { intervalMs: 100 },
    );
    await vi.advanceTimersByTimeAsync(500);
    stop();

    expect(onChange).not.toHaveBeenCalled();
    expect(mockGetPublicKey).toHaveBeenCalled();
    expect(mockGetNetworkDetails).toHaveBeenCalled();
  });

  it("reports a changed address with the snapshot it started from", async () => {
    setFreighterState("G12345", "TESTNET");
    const onChange = vi.fn();

    const stop = watchFreighterChanges(
      { address: "G12345", network: "testnet" },
      onChange,
      { intervalMs: 100 },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange).not.toHaveBeenCalled();

    setFreighterState("GCHANGED", "TESTNET");
    await vi.advanceTimersByTimeAsync(100);
    stop();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      address: "GCHANGED",
      previous: { address: "G12345", network: "testnet" },
    });
  });

  it("reports a network change normalized to lower case", async () => {
    setFreighterState("G12345", "PUBLIC");
    const onChange = vi.fn();

    const stop = watchFreighterChanges(
      { address: "G12345", network: "testnet" },
      onChange,
      { intervalMs: 100 },
    );
    await vi.advanceTimersByTimeAsync(100);
    stop();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({
      network: "public",
      previous: { address: "G12345", network: "testnet" },
    });
  });

  it.each([
    ["empty string", ""],
    ["null", null],
  ])(
    "reports a disconnect when the address changes from G123 to %s",
    async (_label, locked) => {
      setFreighterState("G123", "TESTNET");
      mockGetPublicKey.mockResolvedValue(locked as unknown as string);
      const onChange = vi.fn();
      const onError = vi.fn();

      const stop = watchFreighterChanges(
        { address: "G123", network: "testnet" },
        onChange,
        { intervalMs: 100, onError },
      );
      await vi.advanceTimersByTimeAsync(0);
      stop();

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        disconnected: true,
        previous: { address: "G123", network: "testnet" },
      });
      expect(onError).not.toHaveBeenCalled();
    },
  );

  it("reports the disconnect once and not again while Freighter stays locked", async () => {
    setFreighterState("G123", "TESTNET");
    mockGetPublicKey.mockResolvedValue("");
    const onChange = vi.fn();

    const stop = watchFreighterChanges(
      { address: "G123", network: "testnet" },
      onChange,
      { intervalMs: 100 },
    );
    await vi.advanceTimersByTimeAsync(500);
    stop();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("does not report a disconnect when there was no address to begin with", async () => {
    setFreighterState("", "TESTNET");
    const onChange = vi.fn();

    const stop = watchFreighterChanges(
      { address: null, network: "testnet" },
      onChange,
      { intervalMs: 100 },
    );
    await vi.advanceTimersByTimeAsync(300);
    stop();

    expect(onChange).not.toHaveBeenCalled();
  });

  it("still routes genuine getPublicKey rejections to onError, not onChange", async () => {
    setFreighterState("G123", "TESTNET");
    mockGetPublicKey.mockRejectedValue(new Error("boom"));
    const onChange = vi.fn();
    const onError = vi.fn();

    const stop = watchFreighterChanges(
      { address: "G123", network: "testnet" },
      onChange,
      { intervalMs: 100, onError },
    );
    await vi.advanceTimersByTimeAsync(0);
    stop();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("routes poll failures to onError and keeps polling", async () => {
    setFreighterState("G12345", "TESTNET");
    mockGetPublicKey.mockRejectedValueOnce(new Error("extension locked"));
    const onChange = vi.fn();
    const onError = vi.fn();

    const stop = watchFreighterChanges(
      { address: "G12345", network: "testnet" },
      onChange,
      { intervalMs: 100, onError },
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();

    // The failure must not stop the watcher: a later poll still detects diffs.
    setFreighterState("GCHANGED", "TESTNET");
    await vi.advanceTimersByTimeAsync(100);
    stop();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ address: "GCHANGED" }),
    );
  });

  it("stops polling and stays silent after the returned stop function runs", async () => {
    setFreighterState("G12345", "TESTNET");
    const onChange = vi.fn();

    const stop = watchFreighterChanges(
      { address: "G12345", network: "testnet" },
      onChange,
      { intervalMs: 100 },
    );
    await vi.advanceTimersByTimeAsync(0);
    const callsBeforeStop = mockGetPublicKey.mock.calls.length;

    stop();
    setFreighterState("GCHANGED", "TESTNET");
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockGetPublicKey.mock.calls.length).toBe(callsBeforeStop);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("getFreighterPublicKey", () => {
  it("returns the public key on success", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockGetPublicKey.mockResolvedValue("G12345");

    const result = await getFreighterPublicKey();
    expect(result).toBe("G12345");
  });

  it("throws FreighterError with not_installed when Freighter is not installed", async () => {
    mockIsConnected.mockResolvedValue(false);

    await expect(getFreighterPublicKey()).rejects.toThrow(FreighterError);
    try {
      await getFreighterPublicKey();
    } catch (err) {
      expect(err).toBeInstanceOf(FreighterError);
      expect((err as FreighterError).code).toBe("not_installed");
    }
  });

  it("throws FreighterError with user_rejected when user rejects", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockGetPublicKey.mockRejectedValue(
      new Error("The user rejected this request."),
    );

    await expect(getFreighterPublicKey()).rejects.toThrow(FreighterError);
    try {
      await getFreighterPublicKey();
    } catch (err) {
      expect(err).toBeInstanceOf(FreighterError);
      expect((err as FreighterError).code).toBe("user_rejected");
    }
  });

  it("throws FreighterError with unknown for unexpected errors", async () => {
    mockIsConnected.mockResolvedValue(true);
    mockGetPublicKey.mockRejectedValue(new Error("Network unreachable"));

    await expect(getFreighterPublicKey()).rejects.toThrow(FreighterError);
    try {
      await getFreighterPublicKey();
    } catch (err) {
      expect(err).toBeInstanceOf(FreighterError);
      expect((err as FreighterError).code).toBe("unknown");
    }
  });
});
