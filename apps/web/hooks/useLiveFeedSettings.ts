import { useState, useEffect, useCallback } from 'react';

export function useLiveFeedSettings() {
  const [reducedData, setReducedData] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('trustrove_reduced_data') === 'true';
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trustrove_reduced_data', String(reducedData));
    }
  }, [reducedData]);

  const refresh = useCallback(() => {
    setLastUpdated(new Date());
  }, []);

  return {
    reducedData,
    setReducedData,
    lastUpdated,
    refresh,
  };
}
