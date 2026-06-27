import { toast } from 'sonner';

const explorerUrl = (txHash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${txHash}`;

export function showSuccessToast(action: string, txHash?: string) {
  toast.success(action, {
    description: txHash ? (
      <a
        href={explorerUrl(txHash)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:text-primary/80 text-xs font-mono"
      >
        View on Stellar Expert →
      </a>
    ) : undefined,
    duration: 5000,
  });
}

export function showErrorToast(action: string, error?: Error) {
  toast.error(action, {
    description: error?.message ? (
      <span className="text-xs font-mono text-red-400/80">{error.message}</span>
    ) : undefined,
    duration: 6000,
  });
}
