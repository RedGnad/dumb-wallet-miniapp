import { useEffect, useState } from "react";
import { WORKER_PLAN_URL } from "../lib/plan";

export type PlanStatus = {
  aiEnabled: boolean;
  nextRunISO: string | null;
  lastRunISO: string | null;
  lastTxHash?: string | null;
  raw?: any;
};

export function usePlanStatus(pollMs = 10000) {
  const [status, setStatus] = useState<PlanStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `${WORKER_PLAN_URL}?t=${Date.now()}`;
        const r = await fetch(url, { cache: "no-store" });
        const plan = await r.json();
        if (!alive) return;
        const aiEnabled = plan.enabled !== false && plan.mode !== "off";
        const nextRunISO = plan.nextRun || (plan.nextExecution ? new Date(plan.nextExecution * 1000).toISOString() : null);
        const lastRunISO = plan.lastRun || (plan.lastRunAt ? new Date(plan.lastRunAt * 1000).toISOString() : null);
        setStatus({ aiEnabled, nextRunISO, lastRunISO, lastTxHash: plan.lastTxHash || plan.lastUserOpHash || null, raw: plan });
      } catch (e: any) {
        if (alive) setError(e?.message || "load failed");
      } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const id = setInterval(load, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return { status, loading, error };
}
