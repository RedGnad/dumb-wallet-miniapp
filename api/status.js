// Simple status endpoint for the Mini App
// If WORKER_STATUS_URL is set, this proxies to your backend/worker.
// Otherwise returns a mock payload so the UI works without wiring.

module.exports = async function handler(req, res) {
  try {
    // Option A: read plan.json directly to derive status
    const planUrl = process.env.WORKER_PLAN_URL;
    if (planUrl) {
      try {
        const url = planUrl.includes('?') ? `${planUrl}&_ts=${Date.now()}` : `${planUrl}?_ts=${Date.now()}`;
        const r = await fetch(url, { headers: { 'accept': 'application/json', 'cache-control': 'no-cache' } });
        if (r.ok) {
          const plan = await r.json();
          const aiEnabled = typeof plan.enabled === 'boolean'
            ? !!plan.enabled
            : (plan.mode ? String(plan.mode).toLowerCase() !== 'off' : false);
          // Accept multiple shapes: nextRun (ISO), nextExecution (seconds or ms)
          let nextRunISO = null;
          if (plan.nextRun) {
            const d = new Date(plan.nextRun);
            if (!isNaN(d)) nextRunISO = d.toISOString();
          }
          if (!nextRunISO && plan.nextExecution != null) {
            const t = Number(plan.nextExecution);
            if (!Number.isNaN(t)) {
              const ms = t > 1e12 ? t : t * 1000; // support sec or ms
              const d = new Date(ms);
              if (!isNaN(d)) nextRunISO = d.toISOString();
            }
          }
          // Optional: expose lastRun if present
          let lastRunISO = null;
          if (plan.lastRun) {
            const d = new Date(plan.lastRun);
            if (!isNaN(d)) lastRunISO = d.toISOString();
          }
          return res.status(200).json({ ok: true, source: 'plan', aiEnabled, nextRunISO, lastRunISO, plan });
        }
      } catch (_) { /* fallthrough to worker/mock */ }
    }
    // Option B: proxy to a real worker status endpoint
    const workerUrl = process.env.WORKER_STATUS_URL;
    if (workerUrl) {
      const r = await fetch(workerUrl, { headers: { 'accept': 'application/json' } });
      const data = await r.json();
      return res.status(200).json({ ok: true, source: 'worker', ...data });
    }
    // Mock
    return res.status(200).json({
      ok: true,
      source: 'mock',
      aiEnabled: false,
      nextRunISO: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      lastUserOpHash: null,
      metrics: { txToday: 0, lastError: null }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
