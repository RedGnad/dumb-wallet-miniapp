// Simple status endpoint for the Mini App
// If WORKER_STATUS_URL is set, this proxies to your backend/worker.
// Otherwise returns a mock payload so the UI works without wiring.

module.exports = async function handler(req, res) {
  try {
    // Option A: read plan.json directly to derive status
    const planUrl = process.env.WORKER_PLAN_URL;
    if (planUrl) {
      try {
        const r = await fetch(planUrl, { headers: { 'accept': 'application/json' } });
        if (r.ok) {
          const plan = await r.json();
          const aiEnabled = typeof plan.enabled === 'boolean' ? !!plan.enabled : (plan.mode ? plan.mode !== 'off' : false);
          const nextRunISO = plan.nextExecution ? new Date(plan.nextExecution * 1000).toISOString() : null;
          return res.status(200).json({ ok: true, source: 'plan', aiEnabled, nextRunISO, plan });
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
