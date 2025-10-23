// Root API wrapper to ensure Vercel project at repo root exposes the same endpoint
module.exports = async function handler(req, res) {
  const mod = require('../miniapp-standalone/api/status.js');
  return mod(req, res);
}
