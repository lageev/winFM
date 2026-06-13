const fs = require('fs');
const crypto = require('crypto');
const { esc } = require('./utils');
const {
  ADMIN_USER, ADMIN_PASS, AUTH_ENABLED, SESSION_SECRET, SESSION_TTL,
  ANON_ENABLED, ANON_LIMIT, ANON_IDLE,
} = require('./config');

const COOKIE = 'fm_session';

if (AUTH_ENABLED && !process.env.FM_SECRET) {
  console.warn('提示: 未设置 FM_SECRET，会话密钥随机生成，服务重启后需重新登录。');
}

function hmac(s) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(s).digest('hex');
}

// ── 无状态签名会话：Cookie 值为 "过期时间.HMAC签名"，无需服务端存储，重启后凭固定密钥仍有效 ──
function sign(exp) {
  return hmac(String(exp));
}
function makeToken() {
  const exp = Date.now() + SESSION_TTL;
  return exp + '.' + sign(exp);
}
function verifyToken(token) {
  if (!token) return false;
  const i = token.indexOf('.');
  if (i < 0) return false;
  const exp = token.slice(0, i), sig = token.slice(i + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

// 定长时间安全比较，避免时序侧信道
function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  if (ba.length !== bb.length) { crypto.timingSafeEqual(ba, ba); return false; }
  return crypto.timingSafeEqual(ba, bb);
}

function verifyCredentials(user, pass) {
  // 用户名与密码都参与比较，避免任一短路泄露信息
  const okUser = safeEqual(user, ADMIN_USER);
  const okPass = safeEqual(pass, ADMIN_PASS);
  return okUser && okPass;
}

function getCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0 && part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return '';
}

function setSessionCookie(res, token) {
  const maxAge = token ? Math.floor(SESSION_TTL / 1000) : 0;
  res.setHeader('Set-Cookie',
    COOKIE + '=' + (token || '') + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + maxAge);
}

function isAuthed(req) {
  if (!AUTH_ENABLED) return true;
  return verifyToken(getCookie(req, COOKIE));
}

// next 仅允许站内绝对路径，防开放重定向
function sanitizeNext(next) {
  if (typeof next !== 'string' || next[0] !== '/' || next[1] === '/' || /[\x00-\x1f]/.test(next)) return '/';
  return next;
}

// ── 登录失败限流（按 IP）──
const MAX_FAILS = 5, LOCK_MS = 5 * 60 * 1000;
const fails = new Map();
function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}
function isLocked(ip) {
  const f = fails.get(ip);
  return !!(f && f.until > Date.now());
}
function recordFail(ip) {
  const f = fails.get(ip) || { count: 0, until: 0 };
  f.count++;
  if (f.count >= MAX_FAILS) { f.until = Date.now() + LOCK_MS; f.count = 0; }
  fails.set(ip, f);
}

function readBody(req, limit, cb) {
  let data = '', aborted = false;
  function fail() { if (!aborted) { aborted = true; cb(null); } }
  req.on('data', c => {
    if (aborted) return;
    data += c;
    if (data.length > limit) { req.destroy(); fail(); }
  });
  req.on('end', () => { if (!aborted) cb(data); });
  req.on('error', fail);
}

function loginPage(next, error) {
  const safeNext = esc(sanitizeNext(next));
  const err = error ? '<div class="err">' + esc(error) + '</div>' : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#EAE8DE" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#30302E" media="(prefers-color-scheme: dark)">
<title>登录 - winFM</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23C96442' d='M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/%3E%3C/svg%3E">
<style>
:root{--bg:#EAE8DE;--card:#fff;--fg:#30302E;--muted:#6b6a64;--brand:#C96442;--border:#dcd9cc;--field:#f5f3ea}
@media(prefers-color-scheme:dark){:root{--bg:#1f1f1d;--card:#30302E;--fg:#eceae2;--muted:#a8a69c;--border:#46453f;--field:#3a3a37}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;padding:24px}
.card{width:100%;max-width:360px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:36px 32px;box-shadow:0 12px 40px rgba(0,0,0,.12)}
.brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.mark{width:44px;height:44px;border-radius:12px;background:var(--brand);display:flex;align-items:center;justify-content:center;color:#fff;flex:none}
.mark svg{width:24px;height:24px;fill:currentColor}
.brand h1{margin:0;font-size:20px;font-weight:600}
.brand p{margin:2px 0 0;font-size:13px;color:var(--muted)}
label{display:block;font-size:13px;color:var(--muted);margin:16px 0 6px}
input{width:100%;padding:12px 14px;font-size:15px;color:var(--fg);background:var(--field);border:1px solid var(--border);border-radius:10px;outline:none}
input:focus{border-color:var(--brand)}
button{width:100%;margin-top:24px;padding:13px;font-size:15px;font-weight:600;color:#fff;background:var(--brand);border:none;border-radius:10px;cursor:pointer}
button:hover{filter:brightness(.95)}
.err{margin-top:16px;padding:10px 14px;font-size:13px;color:#b3261e;background:rgba(179,38,30,.1);border-radius:10px}
</style>
</head>
<body>
<form class="card" method="POST" action="/__fm/login">
  <div class="brand">
    <div class="mark"><svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg></div>
    <div><h1>winFM</h1><p>请登录以访问文件</p></div>
  </div>
  <label for="user">用户名</label>
  <input id="user" name="user" autocomplete="username" autofocus required>
  <label for="pass">密码</label>
  <input id="pass" name="pass" type="password" autocomplete="current-password" required>
  <input type="hidden" name="next" value="${safeNext}">
  ${err}
  <button type="submit">登录</button>
</form>
</body>
</html>`;
}

function sendLogin(res, next, error, status) {
  const html = loginPage(next, error);
  res.writeHead(status || 200, { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}

// 处理 /__fm/login 与 /__fm/logout，返回 true 表示已处理
function handleAuthRoutes(req, res, url) {
  const p = url.pathname;

  if (p === '/__fm/logout') {
    setSessionCookie(res, '');
    res.writeHead(302, { Location: '/__fm/login' });
    res.end();
    return true;
  }

  if (p !== '/__fm/login') return false;

  // 未开启鉴权时不暴露登录页
  if (!AUTH_ENABLED) { res.writeHead(302, { Location: '/' }); res.end(); return true; }

  if (req.method === 'GET') {
    if (isAuthed(req)) { res.writeHead(302, { Location: sanitizeNext(url.searchParams.get('next')) }); res.end(); return true; }
    sendLogin(res, url.searchParams.get('next'), '');
    return true;
  }

  if (req.method === 'POST') {
    const ip = clientIp(req);
    if (isLocked(ip)) { sendLogin(res, url.searchParams.get('next'), '尝试过于频繁，请稍后再试', 429); return true; }
    readBody(req, 4096, body => {
      if (body === null) { sendLogin(res, null, '请求无效', 400); return; }
      const form = new URLSearchParams(body);
      const next = sanitizeNext(form.get('next'));
      if (verifyCredentials(form.get('user') || '', form.get('pass') || '')) {
        fails.delete(ip);
        setSessionCookie(res, makeToken());
        res.writeHead(303, { Location: next });
        res.end();
      } else {
        recordFail(ip);
        sendLogin(res, next, '用户名或密码错误', 401);
      }
    });
    return true;
  }

  res.writeHead(405); res.end();
  return true;
}

// 拒绝未授权访问：导航请求重定向登录页，其余请求返回 401
function denyAuth(req, res, url) {
  const mode = req.headers['sec-fetch-mode'];
  const accept = req.headers['accept'] || '';
  const isNav = req.method === 'GET' && (mode === 'navigate' || (!mode && accept.includes('text/html')));
  if (isNav) {
    res.writeHead(302, { Location: '/__fm/login?next=' + encodeURIComponent(url.pathname + url.search) });
    res.end();
  } else {
    res.writeHead(401, { 'Content-Type': 'text/plain;charset=utf-8' });
    res.end('未授权');
  }
  return false;
}

// ── 未登录匿名查看限流：时效内可访问的不同文件数有上限，空闲超时则失活并重置 ──
const anon = new Map(); // ip -> { files:Set<string>, last:number }
function anonymousAllow(ip, fp) {
  const now = Date.now();
  let rec = anon.get(ip);
  if (!rec || now - rec.last > ANON_IDLE) { rec = { files: new Set(), last: now }; anon.set(ip, rec); }
  rec.last = now;
  if (rec.files.has(fp)) return true;        // 已看过的文件不再占用新增额度
  if (rec.files.size >= ANON_LIMIT) return false;
  rec.files.add(fp);
  return true;
}
// 定期清理空闲失活的匿名记录，避免内存累积
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of anon) if (now - rec.last > ANON_IDLE) anon.delete(ip);
}, ANON_IDLE).unref();

// 访问守卫：已登录放行；未登录时仅放行受限的匿名文件直链查看，其余需登录
function guardAccess(req, res, url, fp) {
  if (isAuthed(req)) return true;
  // 写操作与目录类接口（如 dirsize）一律需登录
  if (req.method !== 'GET' || url.searchParams.get('action')) return denyAuth(req, res, url);
  // 关闭匿名查看时，未登录不可访问
  if (!ANON_ENABLED) return denyAuth(req, res, url);
  let st; try { st = fs.statSync(fp); } catch (e) {}
  // 仅允许查看已存在的单个文件；目录列表需登录，避免被整树遍历爬取
  if (!st || st.isDirectory()) return denyAuth(req, res, url);
  if (!anonymousAllow(clientIp(req), fp)) {
    res.writeHead(429, { 'Content-Type': 'text/plain;charset=utf-8' });
    res.end('未登录访问已达上限，请登录后继续');
    return false;
  }
  return true;
}

// ── 分享直链：管理员生成带"查看次数 + 有效期"的签名 token，未登录者也可凭链接访问该文件 ──
// token = base64url(JSON{p:路径, m:最大次数(0=不限), e:过期时间ms(0=永久), i:随机id}) + "." + HMAC
const shares = new Map(); // id -> { views, exp }

function makeShareToken(p, views, exp) {
  const payload = { p, m: views > 0 ? views : 0, e: exp > 0 ? exp : 0, i: crypto.randomBytes(6).toString('hex') };
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return b + '.' + hmac(b);
}

// 校验并按需计数；countThis=false 用于续传/seek 请求（不消耗次数）。返回 { ok, p }
function consumeShare(token, countThis) {
  if (typeof token !== 'string') return { ok: false };
  const dot = token.indexOf('.');
  if (dot < 0) return { ok: false };
  const b = token.slice(0, dot), sig = token.slice(dot + 1);
  if (!safeEqual(sig, hmac(b))) return { ok: false };
  let payload;
  try { payload = JSON.parse(Buffer.from(b, 'base64url').toString()); } catch(e) { return { ok: false }; }
  if (!payload || typeof payload.p !== 'string') return { ok: false };
  if (payload.e > 0 && Date.now() > payload.e) return { ok: false };
  if (payload.m > 0 && countThis) {
    const rec = shares.get(payload.i) || { views: 0, exp: payload.e };
    if (rec.views >= payload.m) return { ok: false };
    rec.views++;
    shares.set(payload.i, rec);
  }
  return { ok: true, p: payload.p };
}
// 定期回收已过期的分享计数
setInterval(() => {
  const now = Date.now();
  for (const [i, rec] of shares) if (rec.exp > 0 && now > rec.exp) shares.delete(i);
}, 60 * 60 * 1000).unref();

module.exports = { handleAuthRoutes, guardAccess, makeShareToken, consumeShare };
