const fs = require('fs');
const os = require('os');
const path = require('path');
const { safeName, safeChildPath, pathExists, realPathInsideRoot, ensureSafeDirectory, getSafePathParam, attachmentDisposition } = require('../utils');
const { copyRecursiveSync } = require('../file-ops');

function handleBatch(req, res, url, rp, fp, action) {
  if (action === 'batchdownload') {
    let names = [];
    try { names = JSON.parse(url.searchParams.get('names') || '[]'); } catch(e) {}
    if (!Array.isArray(names) || names.length === 0) { res.writeHead(400); res.end('Missing names'); return; }
    names = names.map(safeName);
    if (names.some(name => !name)) { res.writeHead(400); res.end('Invalid names'); return; }
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'winfm-zip-'));
    const zipPath = tmpDir + '.zip';
    function cleanupZipTemp() {
      try { fs.unlinkSync(zipPath); } catch(e) {}
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch(e) {}
    }
    try {
      for (const name of names) {
        const src = safeChildPath(fp, name);
        if (!src || !pathExists(src)) continue;
        const srcStat = fs.lstatSync(src);
        if (!realPathInsideRoot(src)) continue;
        const dest = path.join(tmpDir, name);
        try {
          if (srcStat.isDirectory()) copyRecursiveSync(src, dest);
          else fs.copyFileSync(src, dest);
        } catch(e) {}
      }
      const dirName = rp === '/' ? 'files' : path.basename(rp.replace(/[/]$/, ''));
      const zipName = dirName + '.zip';
      const { spawn } = require('child_process');
      const zipProc = spawn('zip', ['-r', zipPath, '.'], { cwd: tmpDir, stdio: ['ignore', 'pipe', 'pipe'] });
      zipProc.on('close', function(code) {
        try {
          if (code !== 0 || !pathExists(zipPath)) {
            res.writeHead(500); res.end('Zip failed');
            cleanupZipTemp();
            return;
          }
          const zipStat = fs.statSync(zipPath);
          res.writeHead(200, {
            'Content-Type': 'application/zip',
            'Content-Disposition': attachmentDisposition(zipName),
            'Content-Length': zipStat.size
          });
          const stream = fs.createReadStream(zipPath);
          stream.pipe(res);
          stream.on('close', function() {
            cleanupZipTemp();
          });
        } catch(e) {
          cleanupZipTemp();
          try { res.writeHead(500); res.end('Error: ' + e.message); } catch(ex) {}
        }
      });
      zipProc.on('error', function(e) {
        cleanupZipTemp();
        try { res.writeHead(500); res.end('Zip error: ' + e.message); } catch(ex) {}
      });
    } catch(e) {
      cleanupZipTemp();
      res.writeHead(500); res.end('Zip error: ' + e.message);
    }
    return;
  }

  if (action === 'listdirs') {
    const targetDir = url.searchParams.get('dir') || '/';
    const targetFp = getSafePathParam(targetDir);
    if (!targetFp || !ensureSafeDirectory(targetFp)) { res.writeHead(400); res.end('Invalid path'); return; }
    try {
      const entries = fs.readdirSync(targetFp, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => e.name)
        .sort((a, b) => a.localeCompare(b));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(entries));
    } catch(e) {
      res.writeHead(500); res.end(e.message);
    }
    return;
  }

  // Not handled here
  return false;
}

module.exports = { handleBatch };
