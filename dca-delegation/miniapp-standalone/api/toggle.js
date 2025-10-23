// Toggle endpoint for the Mini App
// POST { enabled: boolean }
// If WORKER_TOGGLE_URL is set, forwards to your backend/worker. Otherwise stores nothing and responds with the requested state.

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }
  const { enabled } = typeof req.body === 'object' ? req.body : {};
  console.log('[miniapp/toggle] incoming', { enabled });
    // Option A: update plan.json in GitHub repo via contents API (requires GITHUB_TOKEN)
    const ghToken = process.env.GITHUB_TOKEN;
    const repo = process.env.WORKER_PLAN_REPO; // e.g. "RedGnad/Dumb-Wallet-Worker"
    const path = process.env.WORKER_PLAN_PATH || 'plan.json';
    const branch = process.env.WORKER_PLAN_BRANCH || 'main';
    if (ghToken && repo) {
      const api = 'https://api.github.com';
      // 1) get current file to read sha and content
      const getUrl = `${api}/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
      const gr = await fetch(getUrl, { headers: { 'authorization': `Bearer ${ghToken}`, 'accept': 'application/vnd.github+json' } });
      if (!gr.ok) throw new Error(`github get ${gr.status}`);
      const gjson = await gr.json();
      const contentB64 = gjson.content || '';
      const sha = gjson.sha;
      const buff = Buffer.from(contentB64, 'base64');
  let plan = {};
      try { plan = JSON.parse(buff.toString('utf-8')); } catch {}
  // 2) update enabled/mode and nextExecution to immediate
  const now = new Date().toISOString();
  const prevMode = plan.mode;
  plan.enabled = !!enabled;
  // Force explicit mode to avoid sticky 'off' when re-enabling
  plan.mode = !!enabled ? 'ai' : 'off';
  plan.nextRun = now; // ISO triggers immediate run per new worker logic
      delete plan.nextExecution;
      const newContent = Buffer.from(JSON.stringify(plan, null, 2), 'utf-8').toString('base64');
      // 3) put updated file
      const putUrl = `${api}/repos/${repo}/contents/${encodeURIComponent(path)}`;
      const pr = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'authorization': `Bearer ${ghToken}`, 'accept': 'application/vnd.github+json', 'content-type': 'application/json' },
        body: JSON.stringify({ message: `miniapp: set enabled=${!!enabled}`, content: newContent, sha, branch })
      });
  if (!pr.ok) throw new Error(`github put ${pr.status}`);
  console.log('[miniapp/toggle] updated plan', { prevMode, newMode: plan.mode, nextRun: plan.nextRun });
  return res.status(200).json({ ok: true, source: 'github-plan', aiEnabled: !!enabled, mode: plan.mode });
    }
    // Option B: forward to a custom toggle backend if provided
    const workerUrl = process.env.WORKER_TOGGLE_URL;
    if (workerUrl) {
      const r = await fetch(workerUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ enabled: !!enabled })
      });
      const data = await r.json();
      console.log('[miniapp/toggle] forwarded to worker', { enabled: !!enabled });
      return res.status(200).json({ ok: true, source: 'worker', ...data });
    }
    // Mock behavior
    console.log('[miniapp/toggle] mock response', { enabled: !!enabled });
    return res.status(200).json({ ok: true, source: 'mock', aiEnabled: !!enabled, mode: !!enabled ? 'ai' : 'off' });
  } catch (e) {
    console.error('[miniapp/toggle] error', e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
