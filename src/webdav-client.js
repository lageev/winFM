const http = require('http');
const https = require('https');

// ── 远端 WebDAV 客户端：把内部路径（/sub/file）翻译为远端请求 ──

function buildUrl(mount, p) {
  const base = new URL(mount.url); // mounts.add 已保证以 '/' 结尾
  const segs = (p || '/').split('/').filter(Boolean).map(encodeURIComponent);
  let pathname = base.pathname + segs.join('/');
  if ((p || '/').endsWith('/') && segs.length) pathname += '/';
  return new URL(base.origin + pathname);
}

function doRequest(mount, method, p, headers, body) {
  return new Promise((resolve, reject) => {
    const u = buildUrl(mount, p);
    const lib = u.protocol === 'https:' ? https : http;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers: Object.assign({}, headers || {}),
    };
    if (mount.username) {
      opts.headers['Authorization'] = 'Basic ' +
        Buffer.from(mount.username + ':' + (mount.password || '')).toString('base64');
    }
    const req = lib.request(opts, resolve);
    req.setTimeout(30000, () => req.destroy(new Error('远端请求超时')));
    req.on('error', reject);
    if (body && typeof body.pipe === 'function') body.pipe(req);
    else { if (body != null) req.write(body); req.end(); }
  });
}

function readAll(res, limit) {
  return new Promise((resolve, reject) => {
    let data = '', size = 0;
    res.on('data', c => {
      size += c.length;
      if (limit && size > limit) { res.destroy(); reject(new Error('响应过大')); return; }
      data += c;
    });
    res.on('end', () => resolve(data));
    res.on('error', reject);
  });
}

function drain(res) {
  return new Promise(resolve => { res.resume(); res.on('end', resolve); res.on('error', resolve); });
}

function unescapeXml(s) {
  return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// 命名空间无关地取标签内容（兼容 D:href / d:href / lp1:resourcetype 等写法）
function tag(block, name) {
  const m = new RegExp('<(?:[a-z0-9]+:)?' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[a-z0-9]+:)?' + name + '>', 'i').exec(block);
  return m ? m[1] : null;
}

function decodeSegments(pathname) {
  return pathname.split('/').map(s => { try { return decodeURIComponent(s); } catch (e) { return s; } }).join('/');
}

// 解析 207 multistatus，返回子项列表（已剔除集合自身）
function parseList(xml, mount, reqPath) {
  const basePath = decodeSegments(new URL(mount.url).pathname); // 以 '/' 结尾
  const want = '/' + (reqPath || '/').split('/').filter(Boolean).join('/'); // 归一去尾斜杠
  const out = [];
  const blocks = xml.match(/<(?:[a-z0-9]+:)?response[\s>][\s\S]*?<\/(?:[a-z0-9]+:)?response>/gi) || [];
  for (const block of blocks) {
    const hrefRaw = tag(block, 'href');
    if (!hrefRaw) continue;
    let pathname;
    try { pathname = decodeSegments(new URL(unescapeXml(hrefRaw.trim()), mount.url).pathname); }
    catch (e) { continue; }
    let rel = pathname.startsWith(basePath) ? '/' + pathname.slice(basePath.length) : pathname;
    const isDir = /collection/i.test(tag(block, 'resourcetype') || '') || rel.endsWith('/');
    const norm = '/' + rel.split('/').filter(Boolean).join('/');
    if (norm === want) continue; // 集合自身
    const name = rel.split('/').filter(Boolean).pop();
    if (!name) continue;
    const sizeStr = tag(block, 'getcontentlength');
    const mtimeStr = tag(block, 'getlastmodified');
    out.push({
      name,
      isDir,
      size: sizeStr ? Number(sizeStr) || 0 : 0,
      mtime: mtimeStr ? new Date(mtimeStr) : null,
    });
  }
  return out;
}

async function propfind(mount, p, depth) {
  const body = '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><allprop/></propfind>';
  const res = await doRequest(mount, 'PROPFIND', p, {
    'Depth': String(depth),
    'Content-Type': 'application/xml; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  }, body);
  const text = await readAll(res, 16 * 1024 * 1024);
  if (res.statusCode >= 400) { const e = new Error('PROPFIND ' + res.statusCode); e.status = res.statusCode; throw e; }
  return parseList(text, mount, p);
}

// 返回远端响应对象供调用方转发（透传 Range 等头）
function open(mount, p, headers) {
  return doRequest(mount, 'GET', p, headers || {});
}

async function put(mount, p, bodyStream, headers) {
  const res = await doRequest(mount, 'PUT', p, headers || {}, bodyStream);
  await drain(res);
  return res.statusCode;
}

async function mkcol(mount, p) {
  const res = await doRequest(mount, 'MKCOL', p, {});
  await drain(res);
  return res.statusCode;
}

async function del(mount, p) {
  const res = await doRequest(mount, 'DELETE', p, {});
  await drain(res);
  return res.statusCode;
}

async function move(mount, from, to, overwrite) {
  const res = await doRequest(mount, 'MOVE', from, {
    'Destination': buildUrl(mount, to).toString(),
    'Overwrite': overwrite ? 'T' : 'F',
  });
  await drain(res);
  return res.statusCode;
}

async function copy(mount, from, to, overwrite) {
  const res = await doRequest(mount, 'COPY', from, {
    'Destination': buildUrl(mount, to).toString(),
    'Overwrite': overwrite ? 'T' : 'F',
  });
  await drain(res);
  return res.statusCode;
}

module.exports = { propfind, open, put, mkcol, del, move, copy };
