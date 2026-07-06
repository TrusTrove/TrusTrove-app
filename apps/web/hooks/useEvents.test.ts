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
        queryKey: ["recentEvents", 5],
      }),
    );
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
