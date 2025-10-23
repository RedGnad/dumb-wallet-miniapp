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
    // Option A: update plan.json in GitHub repo (requires GITHUB_TOKEN + WORKER_PLAN_REPO)
    const ghToken = process.env.GITHUB_TOKEN;
    const repo = process.env.WORKER_PLAN_REPO; // e.g. "RedGnad/Dumb-Wallet-Worker"
    const path = process.env.WORKER_PLAN_PATH || 'plan.json';
    const branch = process.env.WORKER_PLAN_BRANCH || 'main';
    if (ghToken && repo) {
      console.log('toggle: updating github plan', { repo, path, branch, enabled: !!enabled });
      const api = 'https://api.github.com';
      const getUrl = `${api}/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  const gr = await fetch(getUrl, { headers: { 'authorization': `Bearer ${ghToken}`, 'accept': 'application/vnd.github+json', 'user-agent': 'dumb-wallet-miniapp/1.0' } });
      if (!gr.ok) throw new Error(`github get ${gr.status}`);
      const gjson = await gr.json();
      const sha = gjson.sha;
      const buff = Buffer.from(gjson.content || '', 'base64');
      let plan = {};
      try { plan = JSON.parse(buff.toString('utf-8')); } catch {}
      const now = new Date();
      const nowSec = Math.floor(now.getTime()/1000);
      // Update according to existing schema: prefer 'enabled' if present, otherwise use 'mode'
      if (Object.prototype.hasOwnProperty.call(plan, 'enabled')) {
        plan.enabled = !!enabled;
      }
      // Always set mode for clarity in this schema
      plan.mode = !!enabled ? 'ai' : 'off';
      // Support both shapes for scheduling:
      // - If the plan uses nextRun (ISO), set it to now to trigger soon
      // - If the plan uses nextExecution (epoch sec), set it accordingly
      plan.nextRun = now.toISOString();
      if (Object.prototype.hasOwnProperty.call(plan, 'nextExecution')) {
        plan.nextExecution = nowSec;
      }
      const newContent = Buffer.from(JSON.stringify(plan, null, 2), 'utf-8').toString('base64');
      const putUrl = `${api}/repos/${repo}/contents/${encodeURIComponent(path)}`;
      const pr = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'authorization': `Bearer ${ghToken}`, 'accept': 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'dumb-wallet-miniapp/1.0' },
        body: JSON.stringify({ message: `miniapp: set enabled=${!!enabled}` , content: newContent, sha, branch })
      });
      if (!pr.ok) {
        const bodyTxt = await pr.text();
        console.error('toggle: github put failed', pr.status, bodyTxt);
        return res.status(502).json({ ok: false, error: 'github-put-failed', status: pr.status, body: bodyTxt });
      }
      return res.status(200).json({ ok: true, source: 'github-plan', aiEnabled: !!enabled });
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
      return res.status(200).json({ ok: true, source: 'worker', ...data });
    }
    // Mock behavior
    return res.status(200).json({ ok: true, source: 'mock', aiEnabled: !!enabled });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
