import { useState, useEffect, useCallback } from 'react';

export function useLiveFeedSettings() {
  const [reducedDataMode, setReducedDataMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('trustrove_reduced_data_mode') === 'true';
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trustrove_reduced_data_mode', String(reducedDataMode));
    }
  }, [reducedDataMode]);

  const refresh = useCallback(() => {
    setLastUpdated(new Date());
  }, []);

  return {
    reducedDataMode,
    setReducedDataMode,
    lastUpdated,
    refresh,
  };
}
