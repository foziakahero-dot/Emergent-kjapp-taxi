import { useEffect, useRef, useState } from 'react';
import { storage } from '@/src/utils/storage';

export const SHIFT_GOALS = ['2200', '2800', '3400'] as const;
const validGoal = (value: unknown): value is string => typeof value === 'string' && (SHIFT_GOALS as readonly string[]).includes(value);

/** A personal target, scoped to the signed-in driver on this device. */
export function usePersonalShiftGoal(accountId?: string) {
  const [state, setState] = useState({ owner: accountId, goal: '2200', ready: false });
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;
  const mounted = useRef(true), saving = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let current = true;
    setState({ owner: accountId, goal: '2200', ready: false });
    if (accountId) void storage.getItem(`snar_driver_shift_goal_v1:${accountId}`).then(value => {
      if (current && currentAccount.current === accountId) setState({ owner: accountId, goal: validGoal(value) ? value : '2200', ready: true });
    }).catch(() => { if (current && currentAccount.current === accountId) setState({ owner: accountId, goal: '2200', ready: true }); });
    return () => { current = false; };
  }, [accountId]);
  const save = async (goal: string) => {
    if (!accountId || !state.ready || state.owner !== accountId || saving.current || !validGoal(goal)) return false;
    const owner = accountId;
    saving.current = true;
    try {
      await storage.setItem(`snar_driver_shift_goal_v1:${owner}`, goal);
      if (!mounted.current || currentAccount.current !== owner) return false;
      setState({ owner, goal, ready: true });
      return true;
    } finally { saving.current = false; }
  };
  return { goal: state.owner === accountId ? state.goal : '2200', save };
}
