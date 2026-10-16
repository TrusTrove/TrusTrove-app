import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRecentEvents } from "./useEvents";
import { useQuery } from "@tanstack/react-query";
import { getRecentEvents } from "@/lib/api";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getRecentEvents: vi.fn(),
}));

describe("useRecentEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns events from query", () => {
    const mockEvents = [
      { id: 1, event_type: "Created", data: {} },
      { id: 2, event_type: "Funded", data: {} },
    ];

    vi.mocked(useQuery).mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useRecentEvents());
    expect(result.current.events).toHaveLength(2);
    expect(result.current.events[0].event_type).toBe("Created");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("passes limit to query", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderHook(() => useRecentEvents(5));

    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ["recentEvents", 5, undefined],
      }),
    );
  });

  // Issue #1115: an issuer-scoped feed must be a distinct cache entry, or the
  // dashboard would render the protocol-wide list another consumer cached.
  it("scopes the query key and the request to an issuer", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderHook(() =>
      useRecentEvents(10, {
        issuer: "GISSUERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      }),
    );

    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "recentEvents",
          10,
          "GISSUERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        ],
      }),
    );

    const options = vi.mocked(useQuery).mock.calls[0][0] as unknown as {
      queryFn: () => Promise<unknown>;
    };
    void options.queryFn();
    expect(vi.mocked(getRecentEvents)).toHaveBeenCalledWith(
      10,
      "GISSUERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
  });

  it("requests the protocol-wide feed when no issuer is given", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderHook(() => useRecentEvents(20));

    const options = vi.mocked(useQuery).mock.calls[0][0] as unknown as {
      queryFn: () => Promise<unknown>;
    };
    void options.queryFn();
    expect(vi.mocked(getRecentEvents)).toHaveBeenCalledWith(20, undefined);
  });

  it("passes refetchInterval from options", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    renderHook(() => useRecentEvents(10, { refetchInterval: 15000 }));

    expect(vi.mocked(useQuery)).toHaveBeenCalledWith(
      expect.objectContaining({
        refetchInterval: 15000,
      }),
    );
  });

  it("returns empty array when no data", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useRecentEvents());
    expect(result.current.events).toEqual([]);
  });

  it("shows loading state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useRecentEvents());
    expect(result.current.isLoading).toBe(true);
  });

  it("shows error state", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Event fetch failed"),
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useRecentEvents());
    expect(result.current.error).toEqual(new Error("Event fetch failed"));
  });

  it("handles API rejection", () => {
    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("Network error"),
      refetch: vi.fn(),
    } as any);

    const { result } = renderHook(() => useRecentEvents());
    expect(result.current.error).toEqual(new Error("Network error"));
    expect(result.current.events).toEqual([]);
  });
});
