import { useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import { useAutonomousAi } from "../hooks/useAutonomousAi";

export default function DebugPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { enabled, personality, decisions, error } = useAutonomousAi();

  const lastDecision = useMemo(() => {
    return decisions.length ? decisions[0] : null;
  }, [decisions]);

  return (
    <div className="fixed bottom-3 right-3 z-50 text-xs bg-black/60 text-white rounded-lg p-3 backdrop-blur border border-white/10 space-y-1">
      <div className="font-semibold">Debug</div>
      <div>Connected: {isConnected ? "yes" : "no"}</div>
      <div>Address: {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "-"}</div>
      <div>ChainId: {chainId ?? "-"}</div>
      <div>AI: {enabled ? "on" : "off"} ({personality})</div>
      {lastDecision && (
        <div title={JSON.stringify(lastDecision)}>
          Last decision: {lastDecision.action?.type || "-"}
        </div>
      )}
      {error && <div className="text-red-300">AI error: {error}</div>}
      <div>{new Date().toLocaleTimeString()}</div>
    </div>
  );
}
