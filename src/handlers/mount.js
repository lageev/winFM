const zlib = require('zlib');
const Busboy = require('busboy');
const mounts = require('../mounts');
const dav = require('../webdav-client');
const { getHTML } = require('../template');
const { isAuthed, denyAuth } = require('../auth');
const { isCrossSite, attachmentDisposition, safeName, safeUploadedFilename } = require('../utils');

const MNT_PREFIX = '/__mnt';

// 远端响应头 -> 转发给浏览器的规范名
const HEADER_NAME = {
  'content-type': 'Content-Type', 'content-length': 'Content-Length',
  'content-range': 'Content-Range', 'accept-ranges': 'Accept-Ranges',
  'last-modified': 'Last-Modified', 'etag': 'ETag',
};

function badSeg(s) {
  try { const d = decodeURIComponent(s); return d === '..' || d === '.' || d.includes('\0') || d.includes('/'); }
  catch (e) { return true; }
}

// 解析 /__mnt/<id>/<remote...> -> { mount, remotePath }，失败返回 null
function parse(url) {
  const segs = url.pathname.slice(MNT_PREFIX.length).split('/'); // ['', id, ...]
  const id = segs[1] ? decodeURIComponent(segs[1]) : '';
  const mount = id ? mounts.get(id) : null;
  if (!mount) return { mount: null, id };
  const tail = segs.slice(2);
  if (tail.some(s => s !== '' && badSeg(s))) return null;
  const remotePath = '/' + tail.map(s => decodeURIComponent(s)).filter(Boolean).join('/') +
    (url.pathname.endsWith('/') && tail.length > 1 ? '/' : '');
  return { mount, id, remotePath };
}

function sortItems(items, url) {
  let field = url.searchParams.get('sort') || 'name';
  if (!['name', 'size', 'mtime'].includes(field)) field = 'name';
  const dir = url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const group = url.searchParams.get('group') !== '0';
  items.sort((a, b) => {
    if (group && a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp = 0;
    if (field === 'size') cmp = a.size - b.size;
    else if (field === 'mtime') cmp = (a.mtime ? new Date(a.mtime).getTime() : 0) - (b.mtime ? new Date(b.mtime).getTime() : 0);
    else cmp = a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
    return dir === 'desc' ? -cmp : cmp;
  });
  return { field, dir, group };
}

async function mountList(req, res, url, mount, remotePath, view) {
  let items;
  try { items = await dav.propfind(mount, remotePath.endsWith('/') ? remotePath : remotePath + '/', 1); }
  catch (e) { res.writeHead(502, { 'Content-Type': 'text/html;charset=utf-8' }); res.end('<h1>无法连接远端 WebDAV</h1>'); return; }
  const { field, dir, group } = sortItems(items, url);
  const rp = remotePath.endsWith('/') ? remotePath : remotePath + '/';
  const html = getHTML(items, rp, field, dir, group, view);
  const headers = { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-cache' };
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const gz = zlib.gzipSync(html);
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = gz.length;
    res.writeHead(200, headers); res.end(gz);
  } else {
    res.writeHead(200, headers); res.end(html);
  }
}

async function mountFile(req, res, url, mount, remotePath) {
  const reqHeaders = {};
  if (req.headers.range) reqHeaders['Range'] = req.headers.range;
  let remote;
  try { remote = await dav.open(mount, remotePath, reqHeaders); }
  catch (e) { res.writeHead(502); res.end('远端连接失败'); return; }
  const sc = remote.statusCode;
  if (sc >= 400) { remote.resume(); res.writeHead(sc === 404 ? 404 : 502); res.end(sc === 404 ? 'Not Found' : '远端错误'); return; }
  const out = {};
  for (const h in HEADER_NAME) if (remote.headers[h] !== undefined) out[HEADER_NAME[h]] = remote.headers[h];
  if (!out['Accept-Ranges']) out['Accept-Ranges'] = 'bytes';
  if (url.searchParams.get('download')) {
    out['Content-Type'] = 'application/octet-stream';
    out['Content-Disposition'] = attachmentDisposition(remotePath.split('/').filter(Boolean).pop() || 'download');
  }
  res.writeHead(sc, out);
  remote.on('error', () => res.destroy());
  remote.pipe(res);
}

async function mountDirsize(res, mount, remotePath) {
  let result = { size: 0, files: 0, dirs: 0 };
  try {
    const items = await dav.propfind(mount, remotePath.endsWith('/') ? remotePath : remotePath + '/', 1);
    for (const it of items) {
      if (it.isDir) result.dirs++;
      else { result.files++; result.size += it.size || 0; }
    }
  } catch (e) {}
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result));
}

function ok(code) { return code >= 200 && code < 300; }

// 将剪贴板里的应用路径解析为同一挂载内的远端路径，跨存储返回 null
function remoteOf(appPath, id) {
  if (typeof appPath !== 'string') return null;
  let p; try { p = decodeURIComponent(appPath); } catch (e) { return null; }
  const prefix = MNT_PREFIX + '/' + id;
  if (p !== prefix && !p.startsWith(prefix + '/')) return null;
  let rel = p.slice(prefix.length) || '/';
  if (!rel.startsWith('/')) rel = '/' + rel;
  return rel;
}

async function mountAction(req, res, url, mount, id, remotePath) {
  const action = url.searchParams.get('action');
  const dir = remotePath.endsWith('/') ? remotePath : remotePath + '/';
  try {
    if (action === 'mkdir') {
      const name = safeName(url.searchParams.get('name'));
      if (!name) { res.writeHead(400); res.end('Missing name'); return; }
      const code = await dav.mkcol(mount, dir + name + '/');
      return ok(code) ? (res.writeHead(200), res.end('OK')) : (res.writeHead(500), res.end('创建失败'));
    }
    if (action === 'delete') {
      const name = safeName(url.searchParams.get('name'));
      if (!name) { res.writeHead(400); res.end('Missing name'); return; }
      const code = await dav.del(mount, dir + name);
      return ok(code) ? (res.writeHead(200), res.end('OK')) : (res.writeHead(500), res.end('删除失败'));
    }
    if (action === 'rename') {
      const name = safeName(url.searchParams.get('name'));
      const newName = safeName(url.searchParams.get('newname'));
      if (!name || !newName) { res.writeHead(400); res.end('Missing parameters'); return; }
      const code = await dav.move(mount, dir + name, dir + newName, false);
      if (code === 412) { res.writeHead(409); res.end('目标已存在同名文件或文件夹'); return; }
      return ok(code) ? (res.writeHead(200), res.end('OK')) : (res.writeHead(500), res.end('重命名失败'));
    }
    if (action === 'move' || action === 'copy') {
      const name = safeName(url.searchParams.get('name'));
      if (!name) { res.writeHead(400); res.end('Missing name'); return; }
      const srcRel = remoteOf(url.searchParams.get('src'), id);
      const destRel = remoteOf(url.searchParams.get('dest'), id);
      if (!srcRel || !destRel) { res.writeHead(400); res.end('暂不支持跨存储移动/复制'); return; }
      const destDir = destRel.endsWith('/') ? destRel : destRel + '/';
      const code = action === 'move'
        ? await dav.move(mount, srcRel, destDir + name, false)
        : await dav.copy(mount, srcRel, destDir + name, false);
      if (code === 412) { res.writeHead(409); res.end('目标已存在同名文件或文件夹'); return; }
      return ok(code) ? (res.writeHead(200), res.end('OK')) : (res.writeHead(500), res.end('操作失败'));
    }
    if (action === 'upload') { return mountUpload(req, res, mount, dir); }
    res.writeHead(400); res.end('Unknown action');
  } catch (e) {
    res.writeHead(502); res.end('远端错误');
  }
}

function mountUpload(req, res, mount, dir) {
  let busboy;
  try { busboy = Busboy({ headers: req.headers, defParamCharset: 'utf8', limits: { files: 1, fields: 5, parts: 10, fieldSize: 4096 } }); }
  catch (e) { res.writeHead(400); res.end('Bad request'); return; }

  let folderPath = '', responded = false;
  function respond(status, body) { if (responded || res.writableEnded) return; responded = true; res.writeHead(status); res.end(body); }

  busboy.on('field', (name, value) => { if (name === 'path') folderPath = value; });
  busboy.on('file', async (name, file, info) => {
    const filename = safeUploadedFilename(info && info.filename);
    if (!filename) { file.resume(); respond(400, 'Invalid filename'); return; }
    const sub = String(folderPath || '').replace(/\\/g, '/').split('/').map(safeName).filter(Boolean);
    try {
      let base = dir;
      for (const part of sub) { base += part + '/'; await dav.mkcol(mount, base); } // 已存在返回非 2xx，忽略
      const code = await dav.put(mount, base + filename, file, { 'Content-Type': 'application/octet-stream' });
      respond(ok(code) ? 200 : 500, ok(code) ? 'OK' : 'Upload error');
    } catch (e) { file.resume(); respond(502, 'Upload error'); }
  });
  busboy.on('error', () => respond(400, 'Bad request'));
  req.on('error', () => respond(500, 'Upload error'));
  req.pipe(busboy);
}

async function handleMount(req, res, url) {
  if (!isAuthed(req)) return denyAuth(req, res, url);

  const parsed = parse(url);
  if (!parsed) { res.writeHead(400); res.end('Bad path'); return; }
  const { mount, id, remotePath } = parsed;
  if (!mount) { res.writeHead(404); res.end('挂载不存在'); return; }

  // /__mnt/<id> -> 补尾斜杠进入挂载根
  if (url.pathname === MNT_PREFIX + '/' + encodeURIComponent(id)) {
    res.writeHead(302, { Location: MNT_PREFIX + '/' + encodeURIComponent(id) + '/' + url.search });
    res.end(); return;
  }

  const view = { prefix: MNT_PREFIX + '/' + encodeURIComponent(id), name: mount.name };

  if (req.method === 'POST') {
    if (isCrossSite(req)) { res.writeHead(403); res.end('Forbidden'); return; }
    return mountAction(req, res, url, mount, id, remotePath);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('Method Not Allowed'); return; }

  const action = url.searchParams.get('action');
  if (action === 'dirsize') return mountDirsize(res, mount, remotePath);
  if (url.pathname.endsWith('/')) return mountList(req, res, url, mount, remotePath, view);
  return mountFile(req, res, url, mount, remotePath);
}

module.exports = { handleMount };
