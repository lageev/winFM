const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

// 内置静态资源（CSS/JS/字体），启动时载入内存并预压缩，通过 /__fm/ 路径伺服
const STATIC_DIR = path.join(__dirname, '..', 'static');
const TYPES = {
  '.css': 'text/css;charset=utf-8',
  '.js': 'application/javascript;charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

const cache = {};
try {
  for (const name of fs.readdirSync(STATIC_DIR)) {
    const ext = path.extname(name);
    if (!TYPES[ext]) continue;
    const buf = fs.readFileSync(path.join(STATIC_DIR, name));
    const compressible = ext !== '.woff2';
    cache[name] = {
      buf,
      gz: compressible ? zlib.gzipSync(buf) : null,
      type: TYPES[ext],
      etag: '"' + crypto.createHash('md5').update(buf).digest('hex').slice(0, 16) + '"',
    };
  }
} catch(e) {
  console.error('静态资源加载失败:', e.message);
}

function assetVersion(name) {
  return cache[name] ? cache[name].etag.slice(1, -1) : '';
}

function serveStatic(req, res, name) {
  const item = cache[name];
  if (!item) { res.writeHead(404); res.end('Not found'); return; }
  if (req.headers['if-none-match'] === item.etag) { res.writeHead(304); res.end(); return; }
  // 带 ?v= 版本号的引用永久缓存；无版本号的（如 CSS 内的字体 URL）走 ETag 协商
  const versioned = req.url.includes('?v=');
  const headers = {
    'Content-Type': item.type,
    'ETag': item.etag,
    'Cache-Control': versioned ? 'public,max-age=31536000,immutable' : 'no-cache',
  };
  const body = item.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '') ? item.gz : item.buf;
  if (body === item.gz) headers['Content-Encoding'] = 'gzip';
  headers['Content-Length'] = body.length;
  res.writeHead(200, headers);
  res.end(body);
}

module.exports = { serveStatic, assetVersion };
