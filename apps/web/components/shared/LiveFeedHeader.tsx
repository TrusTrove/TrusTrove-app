import React from 'react';

export interface LiveFeedHeaderProps {
  reducedDataMode: boolean;
  onToggleReducedData: (enabled: boolean) => void;
  lastUpdated: Date;
  onRefresh: () => void;
}

export function LiveFeedHeader({
  reducedDataMode,
  onToggleReducedData,
  lastUpdated,
  onRefresh,
}: LiveFeedHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card font-mono text-xs">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </span>
        <button
          onClick={onRefresh}
          className="px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground transition-all"
        >
          Refresh Now
        </button>
      </div>
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={reducedDataMode}
          onChange={(e) => onToggleReducedData(e.target.checked)}
          className="rounded border-border bg-background text-primary focus:ring-primary"
        />
        <span className="text-slate-300 uppercase tracking-wider text-[10px] font-bold">
          Reduced Data Mode (Disable auto-poll)
        </span>
      </label>
    </div>
  );
}
