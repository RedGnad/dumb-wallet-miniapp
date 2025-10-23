// Toggle endpoint for the Mini App
// POST { enabled: boolean }
// If WORKER_TOGGLE_URL is set, forwards to your backend/worker. Otherwise stores nothing and responds with the requested state.

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }
    const { enabled } = typeof req.body === 'object' ? req.body : {};
    const workerUrl = process.env.WORKER_TOGGLE_URL;
    if (workerUrl) {
      const r = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ enabled: !!enabled })
      });
      const data = await r.json();
      return res.status(200).json({ ok: true, source: 'worker', ...data });
    }
    // Mock behavior
    return res.status(200).json({ ok: true, source: 'mock', aiEnabled: !!enabled });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
