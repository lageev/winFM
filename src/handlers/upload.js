const fs = require('fs');
const path = require('path');
const { safeUploadedFilename, safeChildPath, isInside, safeName } = require('../utils');
const { ROOT } = require('../config');

function handleUpload(req, res, fp) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch && (boundaryMatch[1] || boundaryMatch[2]);
  if (!boundary) { res.writeHead(400); res.end('Bad request'); return; }

  const boundaryBuf = Buffer.from('--' + boundary);
  const delimiter = Buffer.from('\r\n--' + boundary);
  let leftover = Buffer.alloc(0);
  let fileStream = null;
  let folderPath = '';
  let parsing = 'boundary'; // boundary | header | body | done

  const cleanup = () => {
    if (fileStream) { try { fileStream.end(); } catch (_) {} fileStream = null; }
  };

  const safeFolderPath = (raw) => {
    if (typeof raw !== 'string' || !raw) return '';
    const parts = raw.replace(/\\/g, '/').split('/').filter(Boolean);
    const safe = parts.filter(p => p !== '.' && p !== '..' && p !== '');
    return safe.join('/');
  };

  req.on('data', chunk => {
    if (parsing === 'done') return;
    leftover = leftover.length ? Buffer.concat([leftover, chunk]) : chunk;

    while (leftover.length > 0) {
      if (parsing === 'boundary') {
        const idx = leftover.indexOf(boundaryBuf);
        if (idx < 0) {
          leftover = leftover.slice(Math.max(0, leftover.length - boundaryBuf.length));
          break;
        }
        let pos = idx + boundaryBuf.length;
        if (pos + 1 < leftover.length && leftover[pos] === 0x2d && leftover[pos + 1] === 0x2d) {
          parsing = 'done';
          leftover = Buffer.alloc(0);
          break;
        }
        if (pos + 1 < leftover.length && leftover[pos] === 0x0d && leftover[pos + 1] === 0x0a) pos += 2;
        leftover = leftover.slice(pos);
        parsing = 'header';
      }

      if (parsing === 'header') {
        const headerEnd = leftover.indexOf(Buffer.from('\r\n\r\n'));
        if (headerEnd < 0) break;
        const header = leftover.slice(0, headerEnd).toString('utf8');
        const filenameMatch = header.match(/filename="([^"]+)"/);
        const nameMatch = header.match(/name="([^"]+)"/);
        const fieldName = nameMatch ? nameMatch[1] : '';

        if (filenameMatch) {
          const filename = safeUploadedFilename(filenameMatch[1]);
          if (!filename) {
            parsing = 'done';
            res.writeHead(400);
            res.end('Invalid filename');
            cleanup();
            return;
          }
          const sub = safeFolderPath(folderPath);
          const baseDir = sub ? path.join(fp, sub) : fp;
          try { fs.mkdirSync(baseDir, { recursive: true }); } catch (_) {}
          const destPath = safeChildPath(baseDir, filename);
          if (!destPath) {
            parsing = 'done';
            res.writeHead(400);
            res.end('Invalid filename');
            cleanup();
            return;
          }
          fileStream = fs.createWriteStream(destPath);
        } else if (fieldName === 'path') {
          // This is the path form field; read its content in body phase
          fileStream = null;
        } else {
          fileStream = null;
        }
        leftover = leftover.slice(headerEnd + 4);
        parsing = 'body';
      }

      if (parsing === 'body') {
        const delimIdx = leftover.indexOf(delimiter);
        if (delimIdx >= 0) {
          const partData = leftover.slice(0, delimIdx);
          if (fileStream) {
            fileStream.write(partData);
            fileStream.end();
            fileStream = null;
          } else {
            // Non-file field (e.g. path)
            folderPath = partData.toString('utf8').trim();
          }
          leftover = leftover.slice(delimIdx + delimiter.length);
          if (leftover.length >= 2 && leftover[0] === 0x2d && leftover[1] === 0x2d) {
            parsing = 'done';
            leftover = Buffer.alloc(0);
            break;
          }
          if (leftover.length >= 2 && leftover[0] === 0x0d && leftover[1] === 0x0a) {
            leftover = leftover.slice(2);
          }
          parsing = 'header';
        } else {
          const safeLen = Math.max(0, leftover.length - delimiter.length);
          if (safeLen > 0) {
            if (fileStream) fileStream.write(leftover.slice(0, safeLen));
            else folderPath += leftover.slice(0, safeLen).toString('utf8');
            leftover = leftover.slice(safeLen);
          }
          break;
        }
      }
    }
  });

  req.on('end', () => {
    cleanup();
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });

  req.on('error', () => {
    cleanup();
    res.writeHead(500);
    res.end('Upload error');
  });
}

module.exports = { handleUpload };
