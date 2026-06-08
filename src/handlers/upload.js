const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const Busboy = require('busboy');
const { safeUploadedFilename, safeChildPath, safeName } = require('../utils');

function safeFolderPath(raw) {
  if (typeof raw !== 'string' || !raw) return '';
  const parts = raw.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.map(safeName).filter(Boolean).join('/');
}

function handleUpload(req, res, fp) {
  let busboy;
  try {
    busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fields: 5,
        parts: 10,
        fieldSize: 4096,
      },
    });
  } catch (_) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  let folderPath = '';
  let seenFile = false;
  let parsingDone = false;
  let pendingWrites = 0;
  let responded = false;
  const writeStreams = new Set();

  function respond(status, body, headers) {
    if (responded || res.writableEnded) return;
    responded = true;
    res.writeHead(status, headers || {});
    res.end(body);
  }

  function fail(status, body) {
    for (const stream of writeStreams) {
      try { stream.destroy(); } catch (_) {}
    }
    respond(status, body);
  }

  function maybeFinish() {
    if (!parsingDone || pendingWrites > 0 || responded) return;
    if (!seenFile) {
      respond(400, 'No file');
      return;
    }
    respond(200, 'OK', { 'Content-Type': 'text/plain' });
  }

  busboy.on('field', (name, value) => {
    if (name === 'path') folderPath = value;
  });

  busboy.on('file', (name, file, info) => {
    const filename = safeUploadedFilename(info && info.filename);
    if (!filename) {
      file.resume();
      fail(400, 'Invalid filename');
      return;
    }

    const sub = safeFolderPath(folderPath);
    const baseDir = sub ? path.join(fp, sub) : fp;
    let destPath;

    try {
      fs.mkdirSync(baseDir, { recursive: true });
      destPath = safeChildPath(baseDir, filename);
    } catch (_) {
      file.resume();
      fail(500, 'Upload error');
      return;
    }

    if (!destPath) {
      file.resume();
      fail(400, 'Invalid filename');
      return;
    }

    seenFile = true;
    pendingWrites++;
    const out = fs.createWriteStream(destPath, { highWaterMark: 256 * 1024 });
    writeStreams.add(out);

    pipeline(file, out, (err) => {
      writeStreams.delete(out);
      pendingWrites--;
      if (err) {
        try { fs.unlinkSync(destPath); } catch (_) {}
        fail(500, 'Upload error');
        return;
      }
      maybeFinish();
    });
  });

  busboy.on('filesLimit', () => fail(400, 'Too many files'));
  busboy.on('fieldsLimit', () => fail(400, 'Too many fields'));
  busboy.on('partsLimit', () => fail(400, 'Too many parts'));
  busboy.on('error', () => fail(400, 'Bad request'));
  busboy.on('close', () => {
    parsingDone = true;
    maybeFinish();
  });

  req.on('error', () => fail(500, 'Upload error'));
  req.pipe(busboy);
}

module.exports = { handleUpload };
