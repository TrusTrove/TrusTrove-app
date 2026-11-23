import React from 'react';
import { StaleDataIndicator } from '../../components/shared/StaleDataIndicator';

export default function InvoicesPage() {
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastLedger, setLastLedger] = React.useState<number | undefined>(123456);
  const [lastTime, setLastTime] = React.useState<number | undefined>(Date.now() / 1000);
  const [isStale, setIsStale] = React.useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      setLastLedger(123457);
      setLastTime(Date.now() / 1000);
      setIsStale(false);
      setRefreshing(false);
    }, 600);
  };

  return (
    <main className="p-6">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Invoices</h1>
        </div>
        <StaleDataIndicator
          lastIndexedLedger={lastLedger}
          lastIndexedAt={lastTime}
          isStale={isStale}
          onRefresh={handleRefresh}
          isRefreshing={refreshing}
        />
      </div>
      <p>Invoice list view with indexed data status.</p>
    </main>
  );
}
