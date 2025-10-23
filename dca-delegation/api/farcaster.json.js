// Dynamic Farcaster manifest so the same code works across preview/prod domains
module.exports = async function handler(req, res) {
  try {
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').trim();
    const proto = (req.headers['x-forwarded-proto'] || 'https');
    const origin = host ? `${proto}://${host}` : '';
    const homeUrl = origin ? `${origin}/miniapp` : '/miniapp';
    const iconUrl = origin ? `${origin}/og.png` : '/og.png';
    const json = {
      miniapp: {
        version: '1',
        name: 'Dumb Wallet',
        homeUrl,
        iconUrl,
        // Keep capabilities minimal; we add wallet provider so clients know we use it
        requiredCapabilities: ['wallet.getEthereumProvider']
        // You can optionally add requiredChains once you target a supported chain
      }
    };
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    return res.status(200).send(JSON.stringify(json));
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
}
