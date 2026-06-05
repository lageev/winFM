const fs = require('fs');
const path = require('path');
const { ROOT, REAL_ROOT } = require('./config');

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function isInside(base, target) {
  const rel = path.relative(base, target);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function safeDecodeURIComponent(value) {
  if (typeof value !== 'string') return null;
  try { return decodeURIComponent(value); }
  catch(e) { return null; }
}

function safePath(rp) {
  if (typeof rp !== 'string') return null;
  const normalized = rp.replace(/\\/g, '/');
  const requestPath = normalized.startsWith('/') ? normalized : '/' + normalized;
  const fp = path.resolve(ROOT, '.' + requestPath);
  if (!isInside(ROOT, fp)) return null;
  return fp;
}

function pathExists(fp) {
  try { fs.lstatSync(fp); return true; }
  catch(e) {
    if (e && e.code === 'ENOENT') return false;
    throw e;
  }
}

function realPathInsideRoot(fp) {
  try { return isInside(REAL_ROOT, fs.realpathSync(fp)); }
  catch(e) { return false; }
}

function ensureSafeDirectory(fp) {
  if (!fp || !isInside(ROOT, fp)) return false;
  try {
    const st = fs.statSync(fp);
    return st.isDirectory() && realPathInsideRoot(fp);
  } catch(e) {
    return false;
  }
}

function safeName(name) {
  if (typeof name !== 'string') return null;
  if (name.length === 0 || name === '.' || name === '..') return null;
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return null;
  return name;
}

function safeChildPath(dir, name) {
  const cleanName = safeName(name);
  if (!cleanName) return null;
  const fp = path.join(dir, cleanName);
  return isInside(ROOT, fp) ? fp : null;
}

function safeUploadedFilename(rawName) {
  if (typeof rawName !== 'string') return null;
  const basename = rawName.replace(/\\/g, '/').split('/').pop();
  return safeName(basename);
}

function getSafePathParam(value) {
  const decoded = safeDecodeURIComponent(value);
  return decoded === null ? null : safePath(decoded);
}

function attachmentDisposition(filename) {
  const asciiName = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return "attachment; filename=\"" + asciiName + "\"; filename*=UTF-8''" + encodeURIComponent(filename);
}

function itemHref(name, isDir) {
  return encodeURIComponent(name) + (isDir ? '/' : '');
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B','KB','MB','GB','TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = {
  esc, isInside, safeDecodeURIComponent, safePath, pathExists,
  realPathInsideRoot, ensureSafeDirectory, safeName, safeChildPath,
  safeUploadedFilename, getSafePathParam, attachmentDisposition,
  itemHref, formatSize,
};
