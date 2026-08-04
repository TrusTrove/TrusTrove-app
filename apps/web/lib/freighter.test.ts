import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isFreighterInstalled,
  connectFreighter,
  getFreighterPublicKey,
  FreighterError,
} from "./freighter";

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getPublicKey: vi.fn(),
}));

import {
  isConnected,
  requestAccess,
  getPublicKey,
} from "@stellar/freighter-api";

const mockIsConnected = vi.mocked(isConnected);
const mockRequestAccess = vi.mocked(requestAccess);
const mockGetPublicKey = vi.mocked(getPublicKey);

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
