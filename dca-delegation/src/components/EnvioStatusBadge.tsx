import { useEnvioMetrics } from "../hooks/useEnvioMetrics";
import { getEnvioUrl } from "../lib/envioClient";

function shortId(url: string) {
  try {
    const m = url.match(/\/([0-9a-f]{7,8})\//i);
    return m ? m[1] : new URL(url).host;
  } catch {
    return url;
  }
}

export default function EnvioStatusBadge() {
  const { metrics, loading } = useEnvioMetrics();
  const url = getEnvioUrl();
  const id = shortId(url);
  const sinceUTC = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 19) + "Z";
  })();

  return (
    <div className="fixed top-3 right-3 z-50 text-xs">
      <div className="backdrop-blur bg-black/40 border border-white/10 text-white rounded-md px-3 py-2 shadow-lg">
        <div className="font-semibold">
          Envio: <span className="text-emerald-300">{id || "n/a"}</span>
        </div>
        <div className="opacity-80">
          txToday: {loading ? "…" : metrics.txToday}
        </div>
      </div>
      <div className="sr-only">since {sinceUTC}</div>
    </div>
  );
}
