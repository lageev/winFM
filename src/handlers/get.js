const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const os = require('os');
const { pathExists, realPathInsideRoot, attachmentDisposition } = require('../utils');
const { MIME, SIZE_CACHE_NAME, THUMB_CACHE_DIR, AUTH_FILE } = require('../config');
const { getHTML } = require('../template');

// ── 缩略图生成（sharp + ffmpeg）──
let sharp;
try { sharp = require('sharp'); } catch(e) { sharp = null; }
const { execFile } = require('child_process');

const THUMB_EXTS = new Set(['.jpg','.jpeg','.png','.gif','.webp','.bmp','.tiff','.tif','.avif','.heic','.heif']);
const VIDEO_EXTS = new Set(['.mp4','.webm','.mkv','.mov','.m4v']);
const HEIC_EXTS = new Set(['.heic', '.heif']);
const HEIC_CONVERT_VERSION = 3;
const THUMB_WIDTH = 300;
const THUMB_MAX = 200; // 内存 LRU 上限
const MAX_CONCURRENT = 3; // 后台生成并发上限

// ── 内存 LRU 缓存 ──
const thumbCache = new Map();

function thumbKey(fp, mtimeMs, ext) {
  return fp + ':' + mtimeMs + (HEIC_EXTS.has(ext) ? ':heic-v' + HEIC_CONVERT_VERSION : '');
}

function thumbMemGet(fp, mtimeMs, ext) {
  const k = thumbKey(fp, mtimeMs, ext);
  const hit = thumbCache.get(k);
  if (hit) { thumbCache.delete(k); thumbCache.set(k, hit); }
  return hit;
}

function thumbMemSet(fp, mtimeMs, ext, buf) {
  const k = thumbKey(fp, mtimeMs, ext);
  if (thumbCache.has(k)) thumbCache.delete(k);
  thumbCache.set(k, { buf, size: buf.length });
  while (thumbCache.size > THUMB_MAX) { thumbCache.delete(thumbCache.keys().next().value); }
}

// ── 磁盘缓存 ──
function diskCacheKey(fp, mtimeMs, ext) {
  return crypto.createHash('md5').update(thumbKey(fp, mtimeMs, ext)).digest('hex') + '.jpg';
}

async function thumbDiskGet(fp, mtimeMs, ext) {
  const file = path.join(THUMB_CACHE_DIR, diskCacheKey(fp, mtimeMs, ext));
  try {
    const buf = await fs.promises.readFile(file);
    thumbMemSet(fp, mtimeMs, ext, buf);
    return buf;
  } catch(e) { return null; }
}

async function thumbDiskSet(fp, mtimeMs, ext, buf) {
  const file = path.join(THUMB_CACHE_DIR, diskCacheKey(fp, mtimeMs, ext));
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
// ffmpeg 抽帧极耗 CPU/磁盘，用全局闸门限制并发（含后台与按需请求），
// 避免大量视频缩略图把资源占满，拖慢列表加载和视频预览。
const FFMPEG_MAX = 2;
let ffmpegActive = 0;
const ffmpegWaiters = [];

function acquireFfmpeg() {
  if (ffmpegActive < FFMPEG_MAX) { ffmpegActive++; return Promise.resolve(); }
  return new Promise(resolve => ffmpegWaiters.push(resolve));
}
function releaseFfmpeg() {
  const next = ffmpegWaiters.shift();
  if (next) next();        // 名额转交给等待者，计数不变
  else ffmpegActive--;
}

function sharpCanReadHeic() {
  const suffixes = sharp && sharp.format && sharp.format.heif &&
    sharp.format.heif.input && sharp.format.heif.input.fileSuffix;
  return Array.isArray(suffixes) && (suffixes.includes('.heic') || suffixes.includes('.heif'));
}

function streamText(stream) {
  return JSON.stringify({
    codec_name: stream.codec_name,
    profile: stream.profile,
    pix_fmt: stream.pix_fmt,
    disposition: stream.disposition,
    tags: stream.tags,
  }).toLowerCase();
}

function isGrayStream(stream) {
  return /^gray|^monob|^monow/.test(String(stream.pix_fmt || '').toLowerCase());
}

function isAuxiliaryStream(stream) {
  return /auxiliary|auxl|depth|disparity|alpha|gain|semantic|portrait|thumbnail|thumb|preview/.test(streamText(stream));
}

function parseStreamItemId(stream) {
  const values = [
    stream.id,
    stream.tags && stream.tags.id,
    stream.tags && stream.tags.item_id,
    stream.tags && stream.tags.heif_item_id,
  ];
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value).trim();
    if (/^0x[0-9a-f]+$/i.test(text)) return parseInt(text, 16);
    if (/^\d+$/.test(text)) return Number(text);
  }
  return null;
}

function streamIndex(stream) {
  const index = Number(stream.index);
  return Number.isFinite(index) ? index : Number.MAX_SAFE_INTEGER;
}

function parseBoxes(buf, start, end, visitor) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) return null;
      const largeSize = Number(buf.readBigUInt64BE(offset + 8));
      if (!Number.isSafeInteger(largeSize)) return null;
      size = largeSize;
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) return null;

    const boxStart = offset + headerSize;
    const boxEnd = offset + size;
    const result = visitor(type, boxStart, boxEnd);
    if (result !== undefined && result !== null) return result;

    if (type === 'meta' && boxStart + 4 <= boxEnd) {
      const nested = parseBoxes(buf, boxStart + 4, boxEnd, visitor);
      if (nested !== undefined && nested !== null) return nested;
    } else if (type === 'moov' || type === 'udta') {
      const nested = parseBoxes(buf, boxStart, boxEnd, visitor);
      if (nested !== undefined && nested !== null) return nested;
    }

    offset += size;
  }
  return null;
}

async function readHeifPrimaryItemId(fp) {
  try {
    const buf = await fs.promises.readFile(fp);
    return parseBoxes(buf, 0, buf.length, (type, boxStart, boxEnd) => {
      if (type !== 'pitm' || boxStart + 6 > boxEnd) return null;
      const version = buf[boxStart];
      const itemIdOffset = boxStart + 4;
      if (version === 0) return buf.readUInt16BE(itemIdOffset);
      if (itemIdOffset + 4 <= boxEnd) return buf.readUInt32BE(itemIdOffset);
      return null;
    });
  } catch (e) {
    return null;
  }
}

async function probeVideoStreams(fp) {
  return await new Promise(resolve => {
    execFile('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v',
      '-show_streams',
      '-print_format', 'json',
      fp,
    ], { maxBuffer: 2 * 1024 * 1024, timeout: 10000 }, (err, stdout) => {
      if (err) { resolve([]); return; }
      try {
        const json = JSON.parse(stdout);
        resolve(Array.isArray(json.streams) ? json.streams : []);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

async function selectPrimaryImageStream(fp) {
  const streams = (await probeVideoStreams(fp)).filter(stream =>
    Number(stream.width) > 0 && Number(stream.height) > 0
  );
  if (!streams.length) return '0:v:0';

  const primaryItemId = await readHeifPrimaryItemId(fp);
  if (primaryItemId !== null) {
    const primary = streams.find(stream => parseStreamItemId(stream) === primaryItemId);
    if (primary) return '0:' + streamIndex(primary);
  }

  let candidates = streams.filter(stream => !isAuxiliaryStream(stream));
  const colorCandidates = candidates.filter(stream => !isGrayStream(stream));
  if (colorCandidates.length) candidates = colorCandidates;
  if (!candidates.length) candidates = streams;

  candidates.sort((a, b) => {
    const aDefault = a.disposition && a.disposition.default ? 1 : 0;
    const bDefault = b.disposition && b.disposition.default ? 1 : 0;
    if (aDefault !== bDefault) return bDefault - aDefault;
    const aArea = Number(a.width) * Number(a.height);
    const bArea = Number(b.width) * Number(b.height);
    if (aArea !== bArea) return bArea - aArea;
    return streamIndex(a) - streamIndex(b);
  });

  const index = streamIndex(candidates[0]);
  return index === Number.MAX_SAFE_INTEGER ? '0:v:0' : '0:' + index;
}

async function sipsImageToJpeg(fp, opts) {
  if (process.platform !== 'darwin') throw new Error('sips is unavailable');
  opts = opts || {};
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'winfm-heic-'));
  const out = path.join(dir, 'preview.jpg');
  try {
    await new Promise((resolve, reject) => {
      const args = ['-s', 'format', 'jpeg'];
      if (opts.width) args.push('-Z', String(opts.width));
      args.push(fp, '--out', out);
      execFile('sips', args, { maxBuffer: 1024 * 1024, timeout: 20000 }, err => {
        if (err) reject(err);
        else resolve();
      });
    });
    const buf = await fs.promises.readFile(out);
    if (!buf.length) throw new Error('no image');
    return buf;
  } finally {
    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function ffmpegImageToJpeg(fp, opts) {
  opts = opts || {};
  const streamSpecifier = await selectPrimaryImageStream(fp);
  await acquireFfmpeg();
  try {
    return await new Promise((resolve, reject) => {
      const args = ['-hide_banner', '-loglevel', 'error', '-i', fp, '-map', streamSpecifier, '-frames:v', '1'];
      if (opts.width) args.push('-vf', 'scale=' + opts.width + ':-2');
      args.push('-f', 'image2', '-c:v', 'mjpeg', '-pix_fmt', 'yuvj420p', '-q:v', opts.quality >= 90 ? '2' : '4', 'pipe:1');
      execFile('ffmpeg', args, { maxBuffer: 64 * 1024 * 1024, timeout: 20000, encoding: 'buffer' }, (err, stdout) => {
        if (err) return reject(err);
        if (!stdout || !stdout.length) return reject(new Error('no image'));
        resolve(stdout);
      });
    });
  } finally {
    releaseFfmpeg();
  }
}

async function heicToJpeg(fp, opts) {
  opts = opts || {};
  const quality = opts.quality || 90;
  if (sharpCanReadHeic()) {
    let image = sharp(fp).rotate();
    if (opts.width) image = image.resize({ width: opts.width, withoutEnlargement: true });
    return image.jpeg({ quality, mozjpeg: true }).toBuffer();
  }
  try {
    return await sipsImageToJpeg(fp, { width: opts.width, quality });
  } catch (e) {}
  return ffmpegImageToJpeg(fp, { width: opts.width, quality });
}

async function extractVideoFrame(fp) {
  await acquireFfmpeg();
  try {
    return await new Promise((resolve, reject) => {
      execFile('ffmpeg', [
        '-ss', '0', '-i', fp,
        '-vframes', '1', '-vf', 'scale=' + THUMB_WIDTH + ':-2', '-threads', '1',
        '-f', 'image2', '-c:v', 'png', '-pix_fmt', 'rgb24', 'pipe:1',
      ], { maxBuffer: 4 * 1024 * 1024, timeout: 15000, encoding: 'buffer' }, (err, stdout) => {
        if (err) return reject(err);
        if (!stdout || !stdout.length) return reject(new Error('no frame'));
        resolve(stdout);
      });
    });
  } finally {
    releaseFfmpeg();
  }
}

// ── 核心：生成缩略图（带请求合并）──
async function generateThumb(fp, ext, mtimeMs) {
  const k = thumbKey(fp, mtimeMs, ext);

  // 内存命中
  const mem = thumbMemGet(fp, mtimeMs, ext);
  if (mem) return mem.buf;

  // 磁盘命中
  const disk = await thumbDiskGet(fp, mtimeMs, ext);
  if (disk) return disk;

  // 请求合并
  if (inflight.has(k)) return inflight.get(k);

  const promise = (async () => {
    try {
      let buf;
      const isVideo = VIDEO_EXTS.has(ext);
      if (isVideo) {
        if (!sharp) throw new Error('sharp is required for video thumbnails');
        const frame = await extractVideoFrame(fp);
        buf = await sharp(frame).resize({ width: THUMB_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      } else if (HEIC_EXTS.has(ext)) {
        buf = await heicToJpeg(fp, { width: THUMB_WIDTH, quality: 80 });
      } else {
        if (!sharp) throw new Error('sharp is required for image thumbnails');
        buf = await sharp(fp).resize({ width: THUMB_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: 80, mozjpeg: true }).toBuffer();
      }
      thumbMemSet(fp, mtimeMs, ext, buf);
      thumbDiskSet(fp, mtimeMs, ext, buf); // 异步写磁盘，不阻塞返回
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
  for (const item of items) {
    if (item.isDir) continue;
    const ext = path.extname(item.name).toLowerCase();
    // 仅后台预生成图片；视频抽帧太重，改为前端可见时按需生成（受 ffmpeg 闸门限流）
    if (!THUMB_EXTS.has(ext)) continue;
    if (!sharp && !HEIC_EXTS.has(ext)) continue;
    const fp = path.join(dirPath, item.name);
    const k = thumbKey(fp, item.mtime ? new Date(item.mtime).getTime() : 0, ext);
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
        .filter(e => !(rp === '/' && (e.name === SIZE_CACHE_NAME || e.name === '.thumb-cache' || e.name === AUTH_FILE)))
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
    const canGenerateThumb = (THUMB_EXTS.has(ext) && (sharp || HEIC_EXTS.has(ext))) || (VIDEO_EXTS.has(ext) && sharp);
    if (canGenerateThumb) {
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

  const download = url.searchParams.get('download');

  // HEIC/HEIF 预览：浏览器不支持直接显示，服务端转 JPEG 后返回
  if (HEIC_EXTS.has(ext) && !download) {
    const heicEtag = 'W/"heic-v' + HEIC_CONVERT_VERSION + '-' + st.size + '-' + Math.floor(st.mtimeMs) + '"';
    if (req.headers['if-none-match'] === heicEtag) { res.writeHead(304); res.end(); return; }
    try {
      const buf = await heicToJpeg(fp, { quality: 92 });
      res.writeHead(200, {
        'Content-Type': 'image/jpeg',
        'Content-Length': buf.length,
        'Cache-Control': 'public, max-age=3600',
        'ETag': heicEtag,
      });
      res.end(buf);
      return;
    } catch (e) {
      if (url.searchParams.has('preview')) {
        res.writeHead(415, { 'Content-Type': 'text/plain;charset=utf-8' });
        res.end('HEIC/HEIF preview is unavailable');
        return;
      }
      /* 转换失败，回退到下载 */
    }
  }

  // Serve file (streamed; supports HTTP Range for large files / resumable downloads)
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
