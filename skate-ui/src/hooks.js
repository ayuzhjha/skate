import { useState, useEffect, useCallback } from 'react';
import { getState, subscribe, saveState } from './store';

export function useStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribe(() => setTick(t => t + 1));
  }, []);

  return getState();
}

export function useForceUpdate() {
  const [, setTick] = useState(0);
  return useCallback(() => setTick(t => t + 1), []);
}
