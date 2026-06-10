const fs = require('fs');
const path = require('path');
const { ROOT, AUTH, SIZE_CACHE_NAME } = require('../config');
const { safeDecodeURIComponent, safePath, ensureSafeDirectory, getSafePathParam } = require('../utils');
const { handleUpload } = require('./upload');
const { handleAction } = require('./actions');
const { handleBatch } = require('./batch');
const { handleGet } = require('./get');
const { serveStatic } = require('./static');
const { getDirectorySizeAsync } = require('../file-ops');

// Persistent cache for directory sizes
const CACHE_FILE = path.join(ROOT, SIZE_CACHE_NAME);
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

// 变更操作后失效相关缓存：目标自身、其子树、其所有祖先目录
function invalidateSizeCache(fp) {
  if (!fp) return;
  for (const key of Object.keys(sizeCache)) {
    if (key === fp || key.startsWith(fp + path.sep) || fp.startsWith(key + path.sep)) {
      delete sizeCache[key];
    }
  }
  scheduleSave();
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

function checkAuth(req, res) {
  if (!AUTH) return true;
  const expected = 'Basic ' + Buffer.from(AUTH).toString('base64');
  if (req.headers.authorization === expected) return true;
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="winFM"', 'Content-Type': 'text/plain;charset=utf-8' });
  res.end('Unauthorized');
  return false;
}

// CSRF 防护：浏览器跨站发起的 POST 会携带跨站 Origin / Sec-Fetch-Site，直接拒绝
function isCrossSite(req) {
  const site = req.headers['sec-fetch-site'];
  if (site && site !== 'same-origin' && site !== 'none') return true;
  const origin = req.headers.origin;
  if (origin) {
    try { return new URL(origin).host !== req.headers.host; }
    catch(e) { return true; }
  }
  return false;
}

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/__fm/')) {
    serveStatic(req, res, url.pathname.slice('/__fm/'.length));
    return;
  }

  if (!checkAuth(req, res)) return;

  let rp = safeDecodeURIComponent(url.pathname);
  if (rp === null) { res.writeHead(400); res.end('Invalid path'); return; }
  if (!rp.startsWith('/')) rp = '/' + rp;

  const fp = safePath(rp);
  if (!fp) { res.writeHead(403); res.end('Forbidden'); return; }

  // POST actions
  if (req.method === 'POST') {
    if (isCrossSite(req)) { res.writeHead(403); res.end('Forbidden'); return; }
    const action = url.searchParams.get('action');
    if (!ensureSafeDirectory(fp)) {
      res.writeHead(400);
      res.end('Invalid directory');
      return;
    }

    if (action !== 'listdirs') {
      invalidateSizeCache(fp);
      const destParam = url.searchParams.get('dest');
      if (destParam) invalidateSizeCache(getSafePathParam(destParam));
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
