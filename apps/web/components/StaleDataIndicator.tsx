import React from 'react';

export interface StaleDataIndicatorProps {
  lastIndexedAt: number;
  lastLedger: number;
  isStale: boolean;
  onRefresh: () => void;
}

export const StaleDataIndicator: React.FC<StaleDataIndicatorProps> = ({
  lastIndexedAt,
  lastLedger,
  isStale,
  onRefresh,
}) => {
  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">
      <div className="flex items-center space-x-3">
        <span
          className={`w-3 h-3 rounded-full ${
            isStale ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
          }`}
          title={isStale ? 'Data is stale' : 'Data is up to date'}
        />
        <div>
          <span className="text-gray-600 dark:text-gray-300">
            Last indexed: {new Date(lastIndexedAt * 1000).toLocaleTimeString()} (Ledger: {lastLedger})
          </span>
          {isStale && (
            <span className="ml-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
              [Stale]
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onRefresh}
        className="px-3 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition"
      >
        Refresh
      </button>
    </div>
  );
};
