const fs = require('fs');
const path = require('path');

const PORT = 8888;
const ROOT = path.resolve('/data');
try { fs.mkdirSync(ROOT, { recursive: true }); } catch(e) {}
const REAL_ROOT = fs.realpathSync(ROOT);

const MIME = {
  '.html':'text/html;charset=utf-8',
  '.css':'text/css',
  '.js':'application/javascript',
  '.json':'application/json',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.gif':'image/gif',
  '.svg':'image/svg+xml',
  '.pdf':'application/pdf',
  '.zip':'application/zip',
  '.txt':'text/plain;charset=utf-8',
  '.md':'text/plain;charset=utf-8',
  '.mp4':'video/mp4',
  '.webm':'video/webm',
  '.mp3':'audio/mpeg',
  '.wav':'audio/wav',
  '.ico':'image/x-icon',
  '.webp':'image/webp',
  '.doc':'application/msword',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':'application/vnd.ms-excel',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':'application/vnd.ms-powerpoint',
  '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.csv':'text/csv;charset=utf-8',
  '.xml':'text/xml',
  '.yaml':'text/plain',
  '.yml':'text/plain',
  '.log':'text/plain',
  '.sh':'text/plain',
  '.py':'text/plain',
  '.java':'text/plain',
  '.c':'text/plain',
  '.cpp':'text/plain',
  '.h':'text/plain',
  '.go':'text/plain',
  '.rs':'text/plain',
  '.ts':'text/plain',
  '.tsx':'text/plain',
  '.jsx':'text/plain',
  '.vue':'text/plain',
};

module.exports = { PORT, ROOT, REAL_ROOT, MIME };
