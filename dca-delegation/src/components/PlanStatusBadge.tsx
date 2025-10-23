import { usePlanStatus } from "../hooks/usePlanStatus";

export default function PlanStatusBadge() {
  const { status } = usePlanStatus(15000);
  const on = status?.aiEnabled;
  const cls = on
    ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/30"
    : "bg-zinc-700/40 text-zinc-200 border-zinc-400/20";

  return (
    <div className={`fixed top-3 right-3 z-40 text-xs px-3 py-2 rounded-lg border backdrop-blur ${cls}`}>
      <div className="font-semibold">AI {on ? "ON" : "OFF"}</div>
      <div>Next: {status?.nextRunISO ? new Date(status.nextRunISO).toLocaleTimeString() : "-"}</div>
      <div>Last: {status?.lastRunISO ? new Date(status.lastRunISO).toLocaleTimeString() : "-"}</div>
      {status?.lastTxHash && (
        <div title={status.lastTxHash}>Tx: {status.lastTxHash.slice(0, 8)}…</div>
      )}
    </div>
  );
}
