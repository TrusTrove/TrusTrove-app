export function explorerBaseUrl(): string {
  const network =
    process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "public" : "testnet";
  return `https://stellar.expert/explorer/${network}`;
}

export function explorerTxUrl(hash: string): string {
  return `${explorerBaseUrl()}/tx/${encodeURIComponent(hash)}`;
}

export function explorerContractUrl(id: string): string {
  return `${explorerBaseUrl()}/contract/${encodeURIComponent(id)}`;
}
