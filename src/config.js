const fs = require('fs');
const path = require('path');

const PORT = 8888;
const ROOT = path.resolve('/data');
try { fs.mkdirSync(ROOT, { recursive: true }); } catch(e) {}
const REAL_ROOT = fs.realpathSync(ROOT);

const MIME = {
  // Web
  '.html':'text/html;charset=utf-8',
  '.css':'text/css',
  '.js':'application/javascript',
  '.json':'application/json',
  '.xml':'text/xml',
  '.csv':'text/csv;charset=utf-8',
  // Images
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.gif':'image/gif',
  '.svg':'image/svg+xml',
  '.bmp':'image/bmp',
  '.tiff':'image/tiff',
  '.tif':'image/tiff',
  '.ico':'image/x-icon',
  '.webp':'image/webp',
  '.avif':'image/avif',
  // Video
  '.mp4':'video/mp4',
  '.webm':'video/webm',
  '.mkv':'video/x-matroska',
  '.avi':'video/x-msvideo',
  '.mov':'video/quicktime',
  '.wmv':'video/x-ms-wmv',
  '.flv':'video/x-flv',
  '.m4v':'video/mp4',
  '.ts':'video/mp2t',
  '.mts':'video/mp2t',
  '.3gp':'video/3gpp',
  // Audio
  '.mp3':'audio/mpeg',
  '.wav':'audio/wav',
  '.ogg':'audio/ogg',
  '.aac':'audio/aac',
  '.flac':'audio/flac',
  '.m4a':'audio/mp4',
  '.wma':'audio/x-ms-wma',
  '.opus':'audio/opus',
  // Documents
  '.pdf':'application/pdf',
  '.doc':'application/msword',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':'application/vnd.ms-excel',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt':'application/vnd.ms-powerpoint',
  '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Archives
  '.zip':'application/zip',
  '.rar':'application/vnd.rar',
  '.7z':'application/x-7z-compressed',
  '.tar':'application/x-tar',
  '.gz':'application/gzip',
  '.tgz':'application/gzip',
  '.bz2':'application/x-bzip2',
  '.xz':'application/x-xz',
  '.zst':'application/zstd',
  // Mobile / Desktop apps
  '.apk':'application/vnd.android.package-archive',
  '.ipa':'application/octet-stream',
  '.dmg':'application/x-apple-diskimage',
  '.pkg':'application/x-newton-compatible-pkg',
  '.deb':'application/x-debian-package',
  '.rpm':'application/x-rpm',
  '.msi':'application/x-msi',
  '.exe':'application/vnd.microsoft.portable-executable',
  '.appx':'application/vnd.ms-appx',
  // Fonts
  '.ttf':'font/ttf',
  '.otf':'font/otf',
  '.woff':'font/woff',
  '.woff2':'font/woff2',
  '.eot':'application/vnd.ms-fontobject',
  // Text / Code
  '.txt':'text/plain;charset=utf-8',
  '.md':'text/plain;charset=utf-8',
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
