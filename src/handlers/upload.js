const fs = require('fs');
const { safeUploadedFilename, safeChildPath } = require('../utils');

function handleUpload(req, res, fp) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch && (boundaryMatch[1] || boundaryMatch[2]);
  if (!boundary) { res.writeHead(400); res.end('Bad request'); return; }

  let body = [];
  req.on('data', chunk => body.push(chunk));
  req.on('end', () => {
    try {
      const buf = Buffer.concat(body);
      const boundaryBuf = Buffer.from('--' + boundary);
      const delimiter = Buffer.from('\r\n--' + boundary);
      let pos = buf.indexOf(boundaryBuf);
      if (pos < 0) { res.writeHead(200); res.end('OK'); return; }
      pos += boundaryBuf.length;
      while (pos < buf.length) {
        if (buf[pos] === 0x2d && buf[pos+1] === 0x2d) break; // final --
        const headerStart = pos + 2; // skip \r\n
        const headerEnd = buf.indexOf(Buffer.from('\r\n\r\n'), headerStart);
        if (headerEnd < 0) break;
        const header = buf.slice(headerStart, headerEnd).toString('utf8');
        const filenameMatch = header.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          const filename = safeUploadedFilename(filenameMatch[1]);
          if (!filename) {
            res.writeHead(400);
            res.end('Invalid filename');
            return;
          }
          const contentStart = headerEnd + 4;
          const nextBoundary = buf.indexOf(delimiter, contentStart);
          if (nextBoundary < 0) break;
          const destPath = safeChildPath(fp, filename);
          if (!destPath) { res.writeHead(400); res.end('Invalid filename'); return; }
          fs.writeFileSync(destPath, buf.slice(contentStart, nextBoundary));
          pos = nextBoundary + delimiter.length;
        } else {
          const nextBoundary = buf.indexOf(delimiter, headerEnd + 4);
          if (nextBoundary < 0) break;
          pos = nextBoundary + delimiter.length;
        }
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
    } catch(e) {
      res.writeHead(500);
      res.end('Upload error: ' + e.message);
    }
  });
}

module.exports = { handleUpload };
