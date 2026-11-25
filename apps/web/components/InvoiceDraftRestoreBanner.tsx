import React from 'react';

interface InvoiceDraftRestoreBannerProps {
  hasDraft: boolean;
  onRestore: () => void;
  onDiscard: () => void;
}

export const InvoiceDraftRestoreBanner: React.FC<InvoiceDraftRestoreBannerProps> = ({
  hasDraft,
  onRestore,
  onDiscard,
}) => {
  if (!hasDraft) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 mb-4 rounded-md flex items-center justify-between shadow-sm" data-testid="invoice-draft-banner">
      <div>
        <p className="font-medium text-sm">We found a saved invoice draft for this wallet.</p>
        <p className="text-xs text-amber-700">Would you like to restore your previous non-secret form fields?</p>
      </div>
      <div className="flex space-x-2">
        <button
          type="button"
          onClick={onRestore}
          className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          Restore
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="px-3 py-1.5 bg-white border border-amber-300 text-amber-700 text-xs font-medium rounded hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          Discard
        </button>
      </div>
    </div>
  );
};
