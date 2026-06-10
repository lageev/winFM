const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { safeName, safeChildPath, pathExists, realPathInsideRoot, ensureSafeDirectory, isInside, getSafePathParam } = require('../utils');
const { copySafe } = require('../file-ops');

// 不向客户端泄露底层错误（可能包含服务器路径），仅暴露主动抛出的业务提示
function failMessage(e) {
  return e && e.expose ? e.message : '操作失败';
}

async function handleAction(req, res, url, fp, action) {
  if (action === 'mkdir') {
    const name = safeName(url.searchParams.get('name'));
    if (!name) { res.writeHead(400); res.end('Missing name'); return; }
    const newDir = safeChildPath(fp, name);
    if (!newDir) { res.writeHead(400); res.end('Invalid name'); return; }
    try {
      fs.mkdirSync(newDir, { recursive: true });
      res.writeHead(200); res.end('OK');
    } catch(e) {
      res.writeHead(500); res.end(failMessage(e));
    }
    return;
  }

  if (action === 'delete') {
    const name = safeName(url.searchParams.get('name'));
    if (!name) { res.writeHead(400); res.end('Missing name'); return; }
    const target = safeChildPath(fp, name);
    if (!target) { res.writeHead(400); res.end('Invalid path'); return; }
    try {
      const st = fs.lstatSync(target);
      if (st.isSymbolicLink()) {
        fs.unlinkSync(target);
      } else {
        if (!realPathInsideRoot(target)) { res.writeHead(403); res.end('Forbidden'); return; }
        await fsp.rm(target, { recursive: true, force: true });
      }
      res.writeHead(200); res.end('OK');
    } catch(e) {
      res.writeHead(500); res.end(failMessage(e));
    }
    return;
  }

  if (action === 'rename') {
    const name = safeName(url.searchParams.get('name'));
    const newName = safeName(url.searchParams.get('newname'));
    if (!name || !newName) { res.writeHead(400); res.end('Missing parameters'); return; }
    const src = safeChildPath(fp, name);
    const dest = safeChildPath(fp, newName);
    if (!src || !dest) { res.writeHead(400); res.end('Invalid path'); return; }
    if (pathExists(dest)) { res.writeHead(409); res.end('目标已存在同名文件或文件夹'); return; }
    try {
      fs.renameSync(src, dest);
      res.writeHead(200); res.end('OK');
    } catch(e) {
      res.writeHead(500); res.end(failMessage(e));
    }
    return;
  }

  if (action === 'move' || action === 'copy') {
    const name = safeName(url.searchParams.get('name'));
    const destDir = url.searchParams.get('dest');
    const srcParam = url.searchParams.get('src');
    if (!name || !destDir) { res.writeHead(400); res.end('Missing parameters'); return; }
    const src = srcParam ? getSafePathParam(srcParam) : safeChildPath(fp, name);
    const destFolder = getSafePathParam(destDir);
    if (!src || !destFolder || !ensureSafeDirectory(path.dirname(src)) || !ensureSafeDirectory(destFolder)) { res.writeHead(400); res.end('Invalid path'); return; }
    const dest = safeChildPath(destFolder, name);
    if (!dest) { res.writeHead(400); res.end('Invalid path'); return; }
    if (src === dest) { res.writeHead(200); res.end('OK'); return; }
    if (pathExists(dest)) { res.writeHead(409); res.end('目标目录已存在同名文件或文件夹'); return; }
    try {
      if (action === 'move') {
        const srcStat = fs.lstatSync(src);
        if (srcStat.isDirectory() && isInside(path.resolve(src), path.resolve(dest))) {
          res.writeHead(400); res.end('不能将目录移动到自身或子目录'); return;
        }
        fs.renameSync(src, dest);
      } else {
        await copySafe(src, dest);
      }
      res.writeHead(200); res.end('OK');
    } catch(e) {
      res.writeHead(500); res.end(failMessage(e));
    }
    return;
  }

  // Unknown action
  res.writeHead(400); res.end('Unknown action');
}

module.exports = { handleAction };
