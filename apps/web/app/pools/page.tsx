import React from "react";
import { StaleDataIndicator } from "../../components/shared/StaleDataIndicator";

export default function PoolsPage() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastLedger, setLastLedger] = React.useState<number | undefined>(
    654321,
  );
  const [lastTime, setLastTime] = React.useState<number | undefined>(
    Date.now() / 1000 - 120,
  );
  const [isStale, setIsStale] = React.useState(true);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setLastLedger(654322);
      setLastTime(Date.now() / 1000);
      setIsStale(false);
      setRefreshing(false);
    }, 600);
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Liquidity Pools</h1>
      </div>
      <div className="mb-6">
        <StaleDataIndicator
          lastIndexedLedger={lastLedger}
          lastIndexedAt={lastTime}
          isStale={isStale}
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
        />
      </div>
      <p>Liquidity pool views and metrics.</p>
    </main>
  );
}
