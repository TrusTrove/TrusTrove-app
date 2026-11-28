import React from 'react';

interface LiveFeedControlsProps {
  reducedData: boolean;
  setReducedData: (val: boolean) => void;
  lastUpdated: Date;
  onRefresh: () => void;
}

export function LiveFeedControls({ reducedData, setReducedData, lastUpdated, onRefresh }: LiveFeedControlsProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-card border border-border rounded text-xs font-mono">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={reducedData}
            onChange={(e) => setReducedData(e.target.checked)}
            className="rounded border-border bg-secondary text-primary focus:ring-primary"
          />
          <span className="text-muted-foreground uppercase">Reduced-data Mode</span>
        </label>
        <span className="text-muted-foreground">Last updated: {lastUpdated.toLocaleTimeString()}</span>
      </div>
      <button
        onClick={onRefresh}
        className="px-3 py-1 bg-secondary hover:bg-secondary/80 text-foreground rounded font-mono transition-colors"
      >
        Refresh Now
      </button>
    </div>
  );
}
