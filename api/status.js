// Simple status endpoint for the Mini App
// If WORKER_STATUS_URL is set, this proxies to your backend/worker.
// Otherwise returns a mock payload so the UI works without wiring.

module.exports = async function handler(req, res) {
  try {
    // Option A: read status directly from a plan.json hosted in your worker repo (raw URL)
    const planUrl = process.env.WORKER_PLAN_URL;
    if (planUrl) {
      const ts = Date.now();
      const sep = planUrl.includes('?') ? '&' : '?';
      const r = await fetch(`${planUrl}${sep}t=${ts}`, {
        headers: { 'accept': 'application/json' },
        cache: 'no-store'
      });
      if (!r.ok) throw new Error(`plan fetch ${r.status}`)
      const plan = await r.json();
      const aiEnabled = plan.enabled !== false && plan.mode !== 'off';
      const nextRunISO = plan.nextRun || (plan.nextExecution ? new Date(plan.nextExecution * 1000).toISOString() : null);
      const lastRunISO = plan.lastRun || (plan.lastRunAt ? new Date(plan.lastRunAt * 1000).toISOString() : null);
      const lastUserOpHash = plan.lastUserOpHash || plan.lastTxHash || null;
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, source: 'plan', aiEnabled, nextRunISO, lastRunISO, lastUserOpHash, metrics: plan.metrics || {} })
    }
    // Option B: proxy a custom status backend if provided
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
