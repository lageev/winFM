const fs = require('fs');
const { ensureSafeDirectory, getSafePathParam } = require('../utils');

function handleBatch(req, res, url, rp, fp, action) {
  if (action === 'listdirs') {
    const targetDir = url.searchParams.get('dir') || '/';
    const targetFp = getSafePathParam(targetDir);
    if (!targetFp || !ensureSafeDirectory(targetFp)) { res.writeHead(400); res.end('Invalid path'); return; }
    try {
      const entries = fs.readdirSync(targetFp, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(entries));
    } catch(e) {
      res.writeHead(500); res.end(e.message);
    }
    return;
  }

  // Not handled here
  return false;
}

module.exports = { handleBatch };
