const fs = require('fs');
const crypto = require('crypto');
const { MOUNTS_PATH } = require('./config');

// 远端 WebDAV 挂载点：{ id, name, url, username, password }
// 含远端明文凭据，文件权限 0600，仅服务进程可读
let mounts = load();

function load() {
  try {
    const j = JSON.parse(fs.readFileSync(MOUNTS_PATH, 'utf8'));
    return Array.isArray(j) ? j : [];
  } catch (e) { return []; }
}

function save() {
  try { fs.writeFileSync(MOUNTS_PATH, JSON.stringify(mounts), { mode: 0o600 }); return true; }
  catch (e) { return false; }
}

// 对外列表不含密码，避免泄露凭据
function list() {
  return mounts.map(m => ({ id: m.id, name: m.name, url: m.url, username: m.username || '' }));
}

function get(id) {
  return mounts.find(m => m.id === id) || null;
}

function add(info) {
  const name = String(info.name || '').trim();
  let url = String(info.url || '').trim();
  if (!name || !url) return null;
  try { new URL(url); } catch (e) { return null; }
  if (!/^https?:\/\//i.test(url)) return null;
  if (!url.endsWith('/')) url += '/';
  const m = {
    id: crypto.randomBytes(6).toString('hex'),
    name, url,
    username: String(info.username || ''),
    password: String(info.password || ''),
  };
  mounts.push(m);
  save();
  return { id: m.id, name: m.name, url: m.url, username: m.username };
}

function remove(id) {
  const before = mounts.length;
  mounts = mounts.filter(m => m.id !== id);
  if (mounts.length === before) return false;
  save();
  return true;
}

module.exports = { list, get, add, remove };
