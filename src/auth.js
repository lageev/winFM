const fs = require('fs');
const crypto = require('crypto');
const { esc } = require('./utils');
const { version } = require('../package.json');
const {
  ADMIN_USER, ADMIN_PASS, SESSION_SECRET, SESSION_TTL,
  ANON_ENABLED, ANON_LIMIT, ANON_IDLE, CRED_FILE, OPEN_MODE,
} = require('./config');

const COOKIE = 'fm_session';

// ── 管理员凭据三态：环境变量 > 持久化文件 > 未配置（引导设置）──
// creds: { user, secret, fromEnv } 或文件模式额外含 { salt, hash }；为 null 表示未配置
let creds = initCreds();

function initCreds() {
  if (ADMIN_PASS) {
    if (!process.env.FM_SECRET) console.warn('提示: 未设置 FM_SECRET，会话密钥随机生成，服务重启后需重新登录。');
    return { user: ADMIN_USER, secret: SESSION_SECRET, fromEnv: true };
  }
  try {
    const j = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
    if (j && j.user && j.salt && j.hash && j.secret) return { user: j.user, salt: j.salt, hash: j.hash, secret: j.secret };
  } catch(e) {}
  return null;
}

function isAuthActive() { return !!creds; }              // 已配置可登录
function needsSetup() { return !creds && !OPEN_MODE; }   // 未配置且非开放：需引导设置
function activeSecret() { return creds ? creds.secret : SESSION_SECRET; }

function hmac(s) {
  return crypto.createHmac('sha256', activeSecret()).update(s).digest('hex');
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
  if (!creds) return false;
  // 用户名与密码都参与比较，避免任一短路泄露信息
  const okUser = safeEqual(user, creds.user);
  const okPass = creds.fromEnv
    ? safeEqual(pass, ADMIN_PASS)
    : safeEqual(crypto.scryptSync(String(pass), creds.salt, 64).toString('hex'), creds.hash);
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
  if (!creds) return OPEN_MODE;  // 未配置：开放模式放行，否则不放行（将被引导至设置页）
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

const PAGE_CSS = `:root{--bg:#EAE8DE;--card:#fff;--fg:#30302E;--muted:#6b6a64;--brand:#C96442;--border:#dcd9cc;--field:#f5f3ea}
@media(prefers-color-scheme:dark){:root{--bg:#1f1f1d;--card:#30302E;--fg:#eceae2;--muted:#a8a69c;--border:#46453f;--field:#3a3a37}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg);color:var(--fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'PingFang SC','Microsoft YaHei',sans-serif;padding:24px}
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
.auth-footer{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;opacity:.5;font-size:11px;color:var(--muted)}
.auth-footer a{color:var(--muted);display:inline-flex;transition:opacity .12s}
.auth-footer a:hover{opacity:.7}`;

const BRAND_SVG = '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';

function authPage(title, subtitle, formInner) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#EAE8DE" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#30302E" media="(prefers-color-scheme: dark)">
<title>${esc(title)} - winFM</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23C96442' d='M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/%3E%3C/svg%3E">
<style>${PAGE_CSS}</style>
</head>
<body>
<form class="card" method="POST">
  <div class="brand">
    <div class="mark">${BRAND_SVG}</div>
    <div><h1>winFM</h1><p>${esc(subtitle)}</p></div>
  </div>
  ${formInner}
</form>
<div class="auth-footer">
  <a href="https://github.com/lageev/winFM" target="_blank" rel="noopener noreferrer" title="GitHub"><svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg></a>
  <span>winFM v${version}</span>
</div>
</body>
</html>`;
}

function loginPage(next, error) {
  const safeNext = esc(sanitizeNext(next));
  const err = error ? '<div class="err">' + esc(error) + '</div>' : '';
  const inner = `<label for="user">用户名</label>
  <input id="user" name="user" autocomplete="username" autofocus required>
  <label for="pass">密码</label>
  <input id="pass" name="pass" type="password" autocomplete="current-password" required>
  <input type="hidden" name="next" value="${safeNext}">
  ${err}
  <button type="submit" formaction="/__fm/login">登录</button>`;
  return authPage('登录', '请登录以访问文件', inner);
}

function setupPage(error) {
  const err = error ? '<div class="err">' + esc(error) + '</div>' : '';
  const inner = `<label for="user">管理员用户名</label>
  <input id="user" name="user" value="admin" autocomplete="username" autofocus required>
  <label for="pass">设置密码</label>
  <input id="pass" name="pass" type="password" autocomplete="new-password" required>
  <label for="pass2">确认密码</label>
  <input id="pass2" name="pass2" type="password" autocomplete="new-password" required>
  ${err}
  <button type="submit" formaction="/__fm/setup">完成设置</button>`;
  return authPage('初始化', '首次使用，请设置管理员账户', inner);
}

function sendPage(res, html, status) {
  res.writeHead(status || 200, { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(html);
}
function sendLogin(res, next, error, status) { sendPage(res, loginPage(next, error), status); }

// 首次引导设置管理员账户：写入持久化凭据文件并即时生效
function handleSetup(req, res) {
  if (!needsSetup()) { res.writeHead(302, { Location: '/' }); res.end(); return; }  // 已配置或开放模式，无需引导
  if (req.method === 'GET') { sendPage(res, setupPage('')); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
  readBody(req, 4096, body => {
    if (body === null) { sendPage(res, setupPage('请求无效'), 400); return; }
    const form = new URLSearchParams(body);
    const user = (form.get('user') || '').trim() || 'admin';
    const pass = form.get('pass') || '';
    if (pass.length < 6) { sendPage(res, setupPage('密码至少 6 位'), 400); return; }
    if (pass !== (form.get('pass2') || '')) { sendPage(res, setupPage('两次输入的密码不一致'), 400); return; }
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(pass, salt, 64).toString('hex');
    const secret = crypto.randomBytes(32).toString('hex');
    try { fs.writeFileSync(CRED_FILE, JSON.stringify({ user, salt, hash, secret }), { mode: 0o600 }); }
    catch(e) { sendPage(res, setupPage('保存失败，请检查数据目录写入权限'), 500); return; }
    creds = { user, salt, hash, secret };
    setSessionCookie(res, makeToken());  // 设置完成后自动登录
    res.writeHead(303, { Location: '/' });
    res.end();
  });
}

// 处理 /__fm/setup、/__fm/login、/__fm/logout，返回 true 表示已处理
function handleAuthRoutes(req, res, url) {
  const p = url.pathname;

  if (p === '/__fm/setup') { handleSetup(req, res); return true; }

  if (p === '/__fm/logout') {
    setSessionCookie(res, '');
    res.writeHead(302, { Location: '/__fm/login' });
    res.end();
    return true;
  }

  if (p !== '/__fm/login') return false;

  // 未配置凭据时不暴露登录页：需引导则去设置页，开放模式回首页
  if (!isAuthActive()) { res.writeHead(302, { Location: needsSetup() ? '/__fm/setup' : '/' }); res.end(); return true; }

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

// 拒绝未授权访问：导航请求重定向（未配置→设置页，否则→登录页），其余请求返回 401
function denyAuth(req, res, url) {
  const mode = req.headers['sec-fetch-mode'];
  const accept = req.headers['accept'] || '';
  const isNav = req.method === 'GET' && (mode === 'navigate' || (!mode && accept.includes('text/html')));
  if (isNav) {
    const target = needsSetup() ? '/__fm/setup' : ('/__fm/login?next=' + encodeURIComponent(url.pathname + url.search));
    res.writeHead(302, { Location: target });
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
  // 未配置凭据：引导去设置页
  if (needsSetup()) return denyAuth(req, res, url);
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

module.exports = { handleAuthRoutes, guardAccess, makeShareToken, consumeShare, isAuthActive };
