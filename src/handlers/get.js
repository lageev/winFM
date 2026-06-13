const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { pathExists, realPathInsideRoot, attachmentDisposition } = require('../utils');
const { MIME, SIZE_CACHE_NAME, THUMB_CACHE_DIR } = require('../config');
const { getHTML } = require('../template');

// ── 缩略图生成（sharp + ffmpeg）──
let sharp;
try { sharp = require('sharp'); } catch(e) { sharp = null; }
const { execFile } = require('child_process');

const THUMB_EXTS = new Set(['.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff','.tif','.avif']);
const VIDEO_EXTS = new Set(['.mp4','.webm','.mkv','.mov','.m4v']);
const THUMB_WIDTH = 300;
const THUMB_MAX = 200; // 内存 LRU 上限
const MAX_CONCURRENT = 3; // 后台生成并发上限

// ── 内存 LRU 缓存 ──
const thumbCache = new Map();

function thumbKey(fp, mtimeMs) { return fp + ':' + mtimeMs; }

function thumbMemGet(fp, mtimeMs) {
  const k = thumbKey(fp, mtimeMs);
  const hit = thumbCache.get(k);
  if (hit) { thumbCache.delete(k); thumbCache.set(k, hit); }
  return hit;
}

function thumbMemSet(fp, mtimeMs, buf) {
  const k = thumbKey(fp, mtimeMs);
  if (thumbCache.has(k)) thumbCache.delete(k);
  thumbCache.set(k, { buf, size: buf.length });
  while (thumbCache.size > THUMB_MAX) { thumbCache.delete(thumbCache.keys().next().value); }
}

// ── 磁盘缓存 ──
function diskCacheKey(fp, mtimeMs) {
  return crypto.createHash('md5').update(fp + ':' + mtimeMs).digest('hex') + '.jpg';
}

async function thumbDiskGet(fp, mtimeMs) {
  const file = path.join(THUMB_CACHE_DIR, diskCacheKey(fp, mtimeMs));
  try {
    const buf = await fs.promises.readFile(file);
    thumbMemSet(fp, mtimeMs, buf);
    return buf;
  } catch(e) { return null; }
}

async function thumbDiskSet(fp, mtimeMs, buf) {
  const file = path.join(THUMB_CACHE_DIR, diskCacheKey(fp, mtimeMs));
  try { await fs.promises.writeFile(file, buf); } catch(e) {}
}

// ── 请求合并（inflight）──
const inflight = new Map();

// ── 后台预生成队列 ──
let activeCount = 0;
const pendingQueue = [];

function drainQueue() {
  while (activeCount < MAX_CONCURRENT && pendingQueue.length > 0) {
    const { fp, ext } = pendingQueue.shift();
    activeCount++;
    generateThumb(fp, ext, fs.statSync(fp).mtimeMs).catch(() => {}).finally(() => {
      activeCount--;
      drainQueue();
    });
  }
}

// ── 用 ffmpeg 提取视频第 1 帧 ──
function extractVideoFrame(fp) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', [
      '-ss', '0', '-i', fp,
      '-vframes', '1', '-f', 'image2',
      '-c:v', 'png', '-pix_fmt', 'rgb24', 'pipe:1',
    ], { maxBuffer: 4 * 1024 * 1024, timeout: 15000, encoding: 'buffer' }, (err, stdout) => {
      if (err) return reject(err);
      if (!stdout || !stdout.length) return reject(new Error('no frame'));
      resolve(stdout);
    });
  });
}

// ── 核心：生成缩略图（带请求合并）──
async function generateThumb(fp, ext, mtimeMs) {
  const k = thumbKey(fp, mtimeMs);

  // 内存命中
  const mem = thumbMemGet(fp, mtimeMs);
  if (mem) return mem.buf;

  // 磁盘命中
  const disk = await thumbDiskGet(fp, mtimeMs);
  if (disk) return disk;

  // 请求合并
  if (inflight.has(k)) return inflight.get(k);

  const promise = (async () => {
    try {
      let buf;
      const isVideo = VIDEO_EXTS.has(ext);
      if (isVideo) {
        const frame = await extractVideoFrame(fp);
        buf = await sharp(frame).resize({ width: THUMB_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      } else {
        buf = await sharp(fp).resize({ width: THUMB_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      }
      thumbMemSet(fp, mtimeMs, buf);
      thumbDiskSet(fp, mtimeMs, buf); // 异步写磁盘，不阻塞返回
      return buf;
    } finally {
      inflight.delete(k);
    }
  })();

  inflight.set(k, promise);
  return promise;
}

// ── 目录列表后后台预生成 ──
function queueThumb(items, dirPath) {
  if (!sharp) return;
  for (const item of items) {
    if (item.isDir) continue;
    const ext = path.extname(item.name).toLowerCase();
    if (!THUMB_EXTS.has(ext) && !VIDEO_EXTS.has(ext)) continue;
    const fp = path.join(dirPath, item.name);
    const k = thumbKey(fp, item.mtime ? new Date(item.mtime).getTime() : 0);
    if (thumbCache.has(k) || inflight.has(k)) continue;
    pendingQueue.push({ fp, ext });
  }
  drainQueue();
}

// ── 删除文件时清理磁盘缓存 ──
function invalidateThumb(fp) {
  // 惰性验证为主；主动清理可删除匹配前缀的缓存文件
  try {
    const files = fs.readdirSync(THUMB_CACHE_DIR);
    const prefix = crypto.createHash('md5').update(fp).digest('hex');
    for (const f of files) {
      if (f.startsWith(prefix.slice(0, 8))) {
        try { fs.unlinkSync(path.join(THUMB_CACHE_DIR, f)); } catch(e) {}
      }
    }
  } catch(e) {}
}

async function handleGet(req, res, url, rp, fp) {
  if (!pathExists(fp)) {
    res.writeHead(404);
    res.end('<h1>404 Not Found</h1>');
    return;
  }

  if (!realPathInsideRoot(fp)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const st = fs.statSync(fp);

  if (st.isDirectory()) {
    if (!rp.endsWith('/')) { res.writeHead(301, { Location: rp + '/' }); res.end(); return; }

    let items = [];
    try {
      items = fs.readdirSync(fp, { withFileTypes: true })
        .filter(e => !(rp === '/' && (e.name === SIZE_CACHE_NAME || e.name === '.thumb-cache')))
        .map(e => {
          const itemPath = path.join(fp, e.name);
          let size = 0, mtime = null;
          try { const s = fs.lstatSync(itemPath); size = s.size; mtime = s.mtime; } catch(ex) {}
          return { name: e.name, isDir: e.isDirectory(), size, mtime };
        });
    } catch(e) {}

    let sortField = url.searchParams.get('sort') || 'name';
    if (!['name','size','mtime'].includes(sortField)) sortField = 'name';
    const sortDir = url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
    const groupDirs = url.searchParams.get('group') !== '0';

    items.sort((a, b) => {
      if (groupDirs && a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      if (sortField === 'size') cmp = a.size - b.size;
      else if (sortField === 'mtime') cmp = (a.mtime ? new Date(a.mtime).getTime() : 0) - (b.mtime ? new Date(b.mtime).getTime() : 0);
      else cmp = a.name.localeCompare(b.name, 'zh-CN', { numeric: true });
      return sortDir === 'desc' ? -cmp : cmp;
    });

    const html = getHTML(items, rp, sortField, sortDir, groupDirs);
    const headers = { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-cache' };
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      const gz = zlib.gzipSync(html);
      headers['Content-Encoding'] = 'gzip';
      headers['Content-Length'] = gz.length;
      res.writeHead(200, headers);
      res.end(gz);
    } else {
      res.writeHead(200, headers);
      res.end(html);
    }
    // 后台预生成当前目录的缩略图
    queueThumb(items, fp);
    return;
  }

  // ── 缩略图请求（内存 → 磁盘 → 生成）──
  const ext = path.extname(fp).toLowerCase();

  if (url.searchParams.has('thumb')) {
    if (sharp && (THUMB_EXTS.has(ext) || VIDEO_EXTS.has(ext))) {
      const etag = 'W/"thumb-' + st.size + '-' + Math.floor(st.mtimeMs) + '"';
      if (req.headers['if-none-match'] === etag) { res.writeHead(304); res.end(); return; }
      try {
        const buf = await generateThumb(fp, ext, st.mtimeMs);
        res.writeHead(200, {
          'Content-Type': 'image/jpeg',
          'Content-Length': buf.length,
          'Cache-Control': 'public, max-age=86400',
          'ETag': etag,
        });
        res.end(buf);
        return;
      } catch(e) { /* 生成失败，落到下方占位响应 */ }
    }
    // 无法生成缩略图：返回占位，避免回退成下载整张原图（前端 onerror 会显示文件图标）
    res.writeHead(404); res.end();
    return;
  }

  // Serve file (streamed; supports HTTP Range for large files / resumable downloads)
  const download = url.searchParams.get('download');
  const etag = 'W/"' + st.size + '-' + Math.floor(st.mtimeMs) + '"';

  // 条件请求：内容未变化时返回 304（预览图片等不再重复传输）
  if (!req.headers.range) {
    const inm = req.headers['if-none-match'];
    const ims = req.headers['if-modified-since'];
    const notModified = inm
      ? inm === etag
      : (ims && Math.floor(st.mtimeMs / 1000) * 1000 <= Date.parse(ims));
    if (notModified) {
      res.writeHead(304, { 'ETag': etag, 'Last-Modified': st.mtime.toUTCString() });
      res.end();
      return;
    }
  }

  const headers = {
    'Accept-Ranges': 'bytes',
    'ETag': etag,
    'Last-Modified': st.mtime.toUTCString(),
    'Cache-Control': 'public, max-age=3600',
  };
  if (download) {
    headers['Content-Type'] = 'application/octet-stream';
    headers['Content-Disposition'] = attachmentDisposition(path.basename(fp));
  } else {
    headers['Content-Type'] = MIME[ext] || 'application/octet-stream';
  }

  let start = 0, end = st.size - 1, status = 200;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && st.size > 0) {
    if (m[1] === '') { start = Math.max(st.size - Number(m[2]), 0); }
    else { start = Number(m[1]); end = m[2] === '' ? end : Math.min(Number(m[2]), st.size - 1); }
    if (!(start >= 0 && end < st.size && start <= end)) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + st.size });
      res.end();
      return;
    }
    status = 206;
    headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size;
  }

  headers['Content-Length'] = end - start + 1;
  res.writeHead(status, headers);
  const stream = fs.createReadStream(fp, { start, end });
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

module.exports = { handleGet, queueThumb, invalidateThumb };
