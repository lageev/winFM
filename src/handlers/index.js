const { safeDecodeURIComponent, safePath, ensureSafeDirectory } = require('../utils');
const { handleUpload } = require('./upload');
const { handleAction } = require('./actions');
const { handleBatch } = require('./batch');
const { handleGet } = require('./get');

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');
  let rp = safeDecodeURIComponent(url.pathname);
  if (rp === null) { res.writeHead(400); res.end('Invalid path'); return; }
  if (!rp.startsWith('/')) rp = '/' + rp;

  const fp = safePath(rp);
  if (!fp) { res.writeHead(403); res.end('Forbidden'); return; }

  // POST actions
  if (req.method === 'POST') {
    const action = url.searchParams.get('action');
    if (!ensureSafeDirectory(fp)) {
      res.writeHead(400);
      res.end('Invalid directory');
      return;
    }

    if (action === 'upload') {
      handleUpload(req, res, fp);
      return;
    }

    if (action === 'listdirs') {
      handleBatch(req, res, url, rp, fp, action);
      return;
    }

    handleAction(req, res, url, fp, action);
    return;
  }

  // GET
  handleGet(req, res, url, rp, fp);
}

module.exports = { handle };
