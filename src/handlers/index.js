const fs = require('fs');
const path = require('path');
const { ROOT, SIZE_CACHE_NAME, CRED_FILE, MOUNTS_PATH, DAV_PREFIX } = require('../config');
const { safeDecodeURIComponent, safePath, ensureSafeDirectory, getSafePathParam, safeName, safeChildPath, realPathInsideRoot, isCrossSite } = require('../utils');
const { handleAuthRoutes, guardAccess, makeShareToken, consumeShare, isAuthed, denyAuth } = require('../auth');
const { handleUpload } = require('./upload');
const { handleAction } = require('./actions');
const { handleBatch } = require('./batch');
const { handleGet, invalidateThumb } = require('./get');
const { handleDav } = require('./webdav');
const { handleMount } = require('./mount');
const { serveStatic } = require('./static');
const { getDirectorySizeAsync } = require('../file-ops');
const mounts = require('../mounts');

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

function handle(req, res) {
  const url = new URL(req.url, 'http://localhost');

  // WebDAV 服务端：外部客户端挂载本机数据目录（自带 HTTP Basic 鉴权）
  if (url.pathname === DAV_PREFIX || url.pathname.startsWith(DAV_PREFIX + '/')) {
    handleDav(req, res, url);
    return;
  }

  // 远端 WebDAV 挂载浏览（管理员，复用文件管理界面）
  if (url.pathname === '/__mnt' || url.pathname.startsWith('/__mnt/')) {
    handleMount(req, res, url);
    return;
  }

  // 登录 / 登出（始终开放）
  if (handleAuthRoutes(req, res, url)) return;

  // 分享直链访问（凭签名 token，未登录也可访问对应文件）
  if (url.pathname === '/__fm/s') { handleShareAccess(req, res, url); return; }

  // 挂载点管理 API（增删查，需登录）
  if (url.pathname === '/__fm/mounts') { handleMountsApi(req, res, url); return; }

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

  // 凭据/挂载配置文件含敏感信息，禁止任何方式访问
  if (fp === CRED_FILE || fp === MOUNTS_PATH) { res.writeHead(403); res.end('Forbidden'); return; }

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
  if (!target || target === CRED_FILE || !st || !st.isFile() || !realPathInsideRoot(target)) { res.writeHead(404); res.end('Not a file'); return; }
  const views = Math.max(0, Math.floor(Number(url.searchParams.get('views')) || 0));
  const hours = Number(url.searchParams.get('hours')) || 0;
  const exp = hours > 0 ? Date.now() + Math.round(hours * 3600 * 1000) : 0;
  const fileRp = rp.replace(/\/?$/, '/') + name;
  const token = makeShareToken(fileRp, views, exp);
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ path: '/__fm/s?t=' + encodeURIComponent(token) }));
}

// 读取并解析 JSON 请求体（带大小上限），失败回调 null
function readJsonBody(req, limit, cb) {
  let data = '', aborted = false;
  req.on('data', c => {
    if (aborted) return;
    data += c;
    if (data.length > limit) { aborted = true; req.destroy(); cb(null); }
  });
  req.on('end', () => { if (aborted) return; try { cb(JSON.parse(data || '{}')); } catch (e) { cb(null); } });
  req.on('error', () => { if (!aborted) { aborted = true; cb(null); } });
}

// 挂载点管理：GET 列表；POST 新增；POST ?op=delete 删除（不返回远端密码）
function handleMountsApi(req, res, url) {
  if (!isAuthed(req)) return denyAuth(req, res, url);
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mounts.list()));
    return;
  }
  if (req.method === 'POST') {
    if (isCrossSite(req)) { res.writeHead(403); res.end('Forbidden'); return; }
    readJsonBody(req, 8192, body => {
      if (!body) { res.writeHead(400); res.end('Bad request'); return; }
      if (url.searchParams.get('op') === 'delete') {
        const removed = mounts.remove(String(body.id || ''));
        res.writeHead(removed ? 200 : 404); res.end(removed ? 'OK' : 'Not found');
        return;
      }
      const m = mounts.add(body);
      if (!m) { res.writeHead(400); res.end('参数无效（名称与合法的 http(s) 地址必填）'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(m));
    });
    return;
  }
  res.writeHead(405); res.end();
}

// 凭分享 token 访问文件：续传/seek 请求不计入查看次数
function handleShareAccess(req, res, url) {
  const range = req.headers.range || '';
  const countThis = !range || /^bytes=0-/.test(range);
  const r = consumeShare(url.searchParams.get('t'), countThis);
  if (!r.ok) { res.writeHead(403, { 'Content-Type': 'text/plain;charset=utf-8' }); res.end('链接无效或已失效'); return; }
  const fp = safePath(r.p);
  let st; try { st = fs.statSync(fp); } catch(e) {}
  // 仅允许文件，避免 token 指向目录时被列目录；凭据文件禁止
  if (!fp || fp === CRED_FILE || !st || !st.isFile() || !realPathInsideRoot(fp)) { res.writeHead(404); res.end('Not found'); return; }
  handleGet(req, res, url, r.p, fp);
}

module.exports = { handle };
