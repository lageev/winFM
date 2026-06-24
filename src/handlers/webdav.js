const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { ROOT, MIME, DAV_PREFIX, CRED_FILE, MOUNTS_PATH, SIZE_CACHE_NAME, AUTH_FILE, MOUNTS_FILE } = require('../config');
const { safePath, realPathInsideRoot, esc } = require('../utils');
const { copySafe } = require('../file-ops');
const { checkDavAuth } = require('../auth');

// 将 /__dav 之后的路径映射到本地 fp（含安全校验）
function davFp(pathname) {
  let rel = pathname.slice(DAV_PREFIX.length) || '/';
  try { rel = decodeURIComponent(rel); } catch (e) { return null; }
  if (!rel.startsWith('/')) rel = '/' + rel;
  const fp = safePath(rel);
  if (!fp || fp === CRED_FILE || fp === MOUNTS_PATH) return null;
  return fp;
}

function isHidden(name) {
  return name === SIZE_CACHE_NAME || name === '.thumb-cache' || name === AUTH_FILE || name === MOUNTS_FILE;
}

function davOptions(res) {
  res.writeHead(200, {
    'DAV': '1,2',
    'Allow': 'OPTIONS, GET, HEAD, PUT, DELETE, PROPFIND, PROPPATCH, MKCOL, COPY, MOVE, LOCK, UNLOCK',
    'MS-Author-Via': 'DAV',
    'Content-Length': '0',
  });
  res.end();
}

function propEntry(href, st) {
  const isDir = st.isDirectory();
  const lm = new Date(st.mtimeMs).toUTCString();
  const typeXml = isDir ? '<D:resourcetype><D:collection/></D:resourcetype>' : '<D:resourcetype/>';
  const fileXml = isDir ? '' :
    '<D:getcontentlength>' + st.size + '</D:getcontentlength>' +
    '<D:getcontenttype>' + (MIME[path.extname(href).toLowerCase()] || 'application/octet-stream') + '</D:getcontenttype>';
  return '<D:response><D:href>' + esc(href) + '</D:href><D:propstat><D:prop>' +
    '<D:getlastmodified>' + lm + '</D:getlastmodified>' + typeXml + fileXml +
    '</D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>\n';
}

function davPropfind(req, res, url, fp) {
  req.resume();
  let st; try { st = fs.statSync(fp); } catch (e) { res.writeHead(404); res.end('Not Found'); return; }
  if (!realPathInsideRoot(fp)) { res.writeHead(403); res.end('Forbidden'); return; }
  const depth = req.headers['depth'] === '0' ? 0 : 1;
  let selfHref = url.pathname;
  if (st.isDirectory() && !selfHref.endsWith('/')) selfHref += '/';

  const parts = [propEntry(selfHref, st)];
  if (st.isDirectory() && depth === 1) {
    let entries = [];
    try { entries = fs.readdirSync(fp, { withFileTypes: true }); } catch (e) {}
    for (const e of entries) {
      if (fp === ROOT && isHidden(e.name)) continue;
      const childFp = path.join(fp, e.name);
      let cst; try { cst = fs.lstatSync(childFp); } catch (ex) { continue; }
      if (cst.isSymbolicLink()) continue;
      const href = selfHref + encodeURIComponent(e.name) + (cst.isDirectory() ? '/' : '');
      parts.push(propEntry(href, cst));
    }
  }
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:">\n' + parts.join('') + '</D:multistatus>';
  res.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(xml) });
  res.end(xml);
}

function davGet(req, res, fp, headOnly) {
  let st; try { st = fs.statSync(fp); } catch (e) { res.writeHead(404); res.end('Not Found'); return; }
  if (!realPathInsideRoot(fp)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (st.isDirectory()) {
    res.writeHead(200, { 'Content-Type': 'text/plain;charset=utf-8' });
    res.end('WebDAV collection');
    return;
  }
  const ext = path.extname(fp).toLowerCase();
  const headers = {
    'Accept-Ranges': 'bytes',
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Last-Modified': st.mtime.toUTCString(),
  };
  let start = 0, end = st.size - 1, status = 200;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && st.size > 0) {
    if (m[1] === '') start = Math.max(st.size - Number(m[2]), 0);
    else { start = Number(m[1]); end = m[2] === '' ? end : Math.min(Number(m[2]), st.size - 1); }
    if (!(start >= 0 && end < st.size && start <= end)) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + st.size }); res.end(); return;
    }
    status = 206; headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(status, headers);
  if (headOnly) { res.end(); return; }
  const stream = fs.createReadStream(fp, { start, end });
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

function davPut(req, res, fp) {
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir) || !realPathInsideRoot(dir)) { res.writeHead(409); res.end('Conflict'); return; }
  try { if (fs.statSync(fp).isDirectory()) { res.writeHead(405); res.end('Method Not Allowed'); return; } } catch (e) {}
  const existed = fs.existsSync(fp);
  const tmp = fp + '.' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.part';
  const out = fs.createWriteStream(tmp);
  let failed = false;
  function fail() { if (failed) return; failed = true; try { out.destroy(); fs.unlinkSync(tmp); } catch (e) {} res.writeHead(500); res.end('Upload error'); }
  out.on('error', fail);
  req.on('error', fail);
  out.on('finish', () => {
    if (failed) return;
    try { fs.renameSync(tmp, fp); res.writeHead(existed ? 204 : 201); res.end(); }
    catch (e) { fail(); }
  });
  req.pipe(out);
}

async function davDelete(req, res, fp) {
  req.resume();
  let st; try { st = fs.lstatSync(fp); } catch (e) { res.writeHead(404); res.end('Not Found'); return; }
  if (st.isSymbolicLink()) { fs.unlinkSync(fp); res.writeHead(204); res.end(); return; }
  if (!realPathInsideRoot(fp)) { res.writeHead(403); res.end('Forbidden'); return; }
  await fsp.rm(fp, { recursive: true, force: true });
  res.writeHead(204); res.end();
}

function davMkcol(req, res, fp) {
  req.resume();
  if (fs.existsSync(fp)) { res.writeHead(405); res.end('Method Not Allowed'); return; }
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir) || !realPathInsideRoot(dir)) { res.writeHead(409); res.end('Conflict'); return; }
  try { fs.mkdirSync(fp); res.writeHead(201); res.end(); }
  catch (e) { res.writeHead(500); res.end(); }
}

async function davMoveCopy(req, res, fp, method) {
  req.resume();
  const destHeader = req.headers['destination'];
  if (!destHeader) { res.writeHead(400); res.end('Missing Destination'); return; }
  let destPathname;
  try { destPathname = new URL(destHeader, 'http://' + (req.headers.host || 'localhost')).pathname; }
  catch (e) { res.writeHead(400); res.end('Bad Destination'); return; }
  if (!(destPathname === DAV_PREFIX || destPathname.startsWith(DAV_PREFIX + '/'))) { res.writeHead(502); res.end('Bad Gateway'); return; }
  const destFp = davFp(destPathname);
  if (!destFp) { res.writeHead(403); res.end('Forbidden'); return; }
  try { fs.lstatSync(fp); } catch (e) { res.writeHead(404); res.end('Not Found'); return; }
  const overwrite = String(req.headers['overwrite'] || 'T').toUpperCase() !== 'F';
  const destExisted = fs.existsSync(destFp);
  if (destExisted && !overwrite) { res.writeHead(412); res.end('Precondition Failed'); return; }
  try {
    if (destExisted) await fsp.rm(destFp, { recursive: true, force: true });
    if (method === 'MOVE') fs.renameSync(fp, destFp);
    else await copySafe(fp, destFp);
    res.writeHead(destExisted ? 204 : 201); res.end();
  } catch (e) { res.writeHead(500); res.end(); }
}

// 占位锁：满足要求 LOCK 的客户端（Windows/macOS），不做真实并发控制
function davLock(req, res) {
  req.resume();
  const token = 'opaquelocktoken:' + crypto.randomBytes(16).toString('hex');
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n<D:prop xmlns:D="DAV:"><D:lockdiscovery><D:activelock>' +
    '<D:locktype><D:write/></D:locktype><D:lockscope><D:exclusive/></D:lockscope>' +
    '<D:depth>infinity</D:depth><D:timeout>Second-3600</D:timeout>' +
    '<D:locktoken><D:href>' + token + '</D:href></D:locktoken>' +
    '</D:activelock></D:lockdiscovery></D:prop>';
  res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Lock-Token': '<' + token + '>', 'Content-Length': Buffer.byteLength(xml) });
  res.end(xml);
}

function davProppatch(req, res, url) {
  req.resume();
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n<D:multistatus xmlns:D="DAV:"><D:response><D:href>' +
    esc(url.pathname) + '</D:href><D:propstat><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response></D:multistatus>';
  res.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(xml) });
  res.end(xml);
}

async function handleDav(req, res, url) {
  if (!checkDavAuth(req)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="winFM WebDAV"', 'Content-Type': 'text/plain;charset=utf-8' });
    res.end('Unauthorized');
    return;
  }
  if (req.method === 'OPTIONS') { davOptions(res); return; }

  const fp = davFp(url.pathname);
  if (!fp) { res.writeHead(403); res.end('Forbidden'); return; }

  try {
    switch (req.method) {
      case 'PROPFIND': return davPropfind(req, res, url, fp);
      case 'GET': return davGet(req, res, fp, false);
      case 'HEAD': return davGet(req, res, fp, true);
      case 'PUT': return davPut(req, res, fp);
      case 'MKCOL': return davMkcol(req, res, fp);
      case 'DELETE': return await davDelete(req, res, fp);
      case 'MOVE':
      case 'COPY': return await davMoveCopy(req, res, fp, req.method);
      case 'LOCK': return davLock(req, res);
      case 'UNLOCK': res.writeHead(204); res.end(); return;
      case 'PROPPATCH': return davProppatch(req, res, url);
      default: res.writeHead(405); res.end('Method Not Allowed');
    }
  } catch (e) {
    if (!res.headersSent) { res.writeHead(500); res.end('Internal error'); }
  }
}

module.exports = { handleDav };
