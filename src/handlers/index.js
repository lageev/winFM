const { safeDecodeURIComponent, safePath, ensureSafeDirectory } = require('../utils');
const { handleUpload } = require('./upload');
const { handleAction } = require('./actions');
const { handleBatch } = require('./batch');
const { handleGet } = require('./get');
const fs = require('fs');
const path = require('path');
const { getDirectorySizeAsync } = require('../file-ops');

// Persistent cache for directory sizes
const CACHE_FILE = '/data/.dirsize-cache.json';
const CACHE_TTL = 5 * 60 * 1000;
let sizeCache = {};

try { sizeCache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch(e) { sizeCache = {}; }

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(function() {
    saveTimer = null;
    try { fs.writeFileSync(CACHE_FILE, JSON.stringify(sizeCache)); } catch(e) {}
  }, 2000);
}

function getCachedDirSize(dirPath, callback) {
  const cached = sizeCache[dirPath];
  if (cached && Date.now() - cached.time < CACHE_TTL) { callback(cached.value); return; }
  getDirectorySizeAsync(dirPath).then(function(result) {
    sizeCache[dirPath] = { value: result, time: Date.now() };
    scheduleSave();
    callback(result);
  }).catch(function() {
    callback({ size: 0, files: 0, dirs: 0 });
  });
}

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

  // GET - API: directory size
  if (url.searchParams.get('action') === 'dirsize') {
    getCachedDirSize(fp, function(result) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    });
    return;
  }

  // GET
  handleGet(req, res, url, rp, fp);
}

module.exports = { handle };
