const fs = require('fs');
const path = require('path');
const { ROOT, SIZE_CACHE_NAME } = require('../config');
const { safeDecodeURIComponent, safePath, ensureSafeDirectory, getSafePathParam, safeName, safeChildPath, realPathInsideRoot } = require('../utils');
const { handleAuthRoutes, guardAccess, makeShareToken, consumeShare } = require('../auth');
const { handleUpload } = require('./upload');
const { handleAction } = require('./actions');
const { handleBatch } = require('./batch');
const { handleGet, invalidateThumb } = require('./get');
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

  // 登录 / 登出（始终开放）
  if (handleAuthRoutes(req, res, url)) return;

  // 分享直链访问（凭签名 token，未登录也可访问对应文件）
  if (url.pathname === '/__fm/s') { handleShareAccess(req, res, url); return; }

  // 内置静态资源（CSS/JS/字体，无敏感信息，开放）
  if (url.pathname.startsWith('/__fm/')) {
    serveStatic(req, res, url.pathname.slice('/__fm/'.length));
    return;
  }

  let rp = safeDecodeURIComponent(url.pathname);
  if (rp === null) { res.writeHead(400); res.end('Invalid path'); return; }
  if (!rp.startsWith('/')) rp = '/' + rp;

  const fp = safePath(rp);
  if (!fp) { res.writeHead(403); res.end('Forbidden'); return; }

  // 鉴权：已登录放行；未登录仅允许受限的匿名文件直链查看（次数/空闲时效限制）
  if (!guardAccess(req, res, url, fp)) return;

  // POST actions
  if (req.method === 'POST') {
    if (isCrossSite(req)) { res.writeHead(403); res.end('Forbidden'); return; }
    const action = url.searchParams.get('action');
    if (!ensureSafeDirectory(fp)) {
      res.writeHead(400);
      res.end('Invalid directory');
      return;
    }

    // 分享操作不改动文件，无需失效缓存
    if (action === 'share') {
      handleShare(req, res, url, rp, fp);
      return;
    }

    if (action !== 'listdirs') {
      invalidateSizeCache(fp);
      invalidateThumb(fp);
      const destParam = url.searchParams.get('dest');
      if (destParam) {
        invalidateSizeCache(getSafePathParam(destParam));
        invalidateThumb(getSafePathParam(destParam));
      }
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

// 管理员生成分享链接：name=文件名, views=最大查看次数(0=不限), hours=有效期小时(0=永久)
function handleShare(req, res, url, rp, fp) {
  const name = safeName(url.searchParams.get('name'));
  if (!name) { res.writeHead(400); res.end('Missing name'); return; }
  const target = safeChildPath(fp, name);
  let st; try { st = fs.statSync(target); } catch(e) {}
  if (!target || !st || !st.isFile() || !realPathInsideRoot(target)) { res.writeHead(404); res.end('Not a file'); return; }
  const views = Math.max(0, Math.floor(Number(url.searchParams.get('views')) || 0));
  const hours = Number(url.searchParams.get('hours')) || 0;
  const exp = hours > 0 ? Date.now() + Math.round(hours * 3600 * 1000) : 0;
  const fileRp = rp.replace(/\/?$/, '/') + name;
  const token = makeShareToken(fileRp, views, exp);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ path: '/__fm/s?t=' + encodeURIComponent(token) }));
}

// 凭分享 token 访问文件：续传/seek 请求不计入查看次数
function handleShareAccess(req, res, url) {
  const range = req.headers.range || '';
  const countThis = !range || /^bytes=0-/.test(range);
  const r = consumeShare(url.searchParams.get('t'), countThis);
  if (!r.ok) { res.writeHead(403, { 'Content-Type': 'text/plain;charset=utf-8' }); res.end('链接无效或已失效'); return; }
  const fp = safePath(r.p);
  let st; try { st = fs.statSync(fp); } catch(e) {}
  // 仅允许文件，避免 token 指向目录时被列目录
  if (!fp || !st || !st.isFile() || !realPathInsideRoot(fp)) { res.writeHead(404); res.end('Not found'); return; }
  handleGet(req, res, url, r.p, fp);
}

module.exports = { handle };
