// Simple status endpoint for the Mini App
// If WORKER_STATUS_URL is set, this proxies to your backend/worker.
// Otherwise returns a mock payload so the UI works without wiring.

module.exports = async function handler(req, res) {
  try {
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
