const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.FM_PORT) || 8888;
const ROOT = path.resolve(process.env.FM_ROOT || '/data');
try { fs.mkdirSync(ROOT, { recursive: true }); } catch(e) {}
const REAL_ROOT = fs.realpathSync(ROOT);

// 管理员登录鉴权：仅单一管理员账户
// FM_USER / FM_PASS 为推荐写法；FM_AUTH="user:pass" 为旧格式，向后兼容
const FM_AUTH = process.env.FM_AUTH || '';
const ADMIN_USER = process.env.FM_USER || FM_AUTH.split(':')[0] || 'admin';
const ADMIN_PASS = process.env.FM_PASS || (FM_AUTH.includes(':') ? FM_AUTH.slice(FM_AUTH.indexOf(':') + 1) : '');
// 会话签名密钥：未配置则随机生成（服务重启后需重新登录），配置 FM_SECRET 可持久化会话
const SESSION_SECRET = process.env.FM_SECRET || crypto.randomBytes(32).toString('hex');
// 会话有效期（小时），默认 7 天
const SESSION_TTL = (Number(process.env.FM_SESSION_HOURS) || 168) * 3600 * 1000;

// 未登录匿名查看：保留直链查看权限，但限制可访问的不同文件数与空闲时效
// FM_ANON=0 可关闭匿名查看（恢复为所有访问都需登录）
const ANON_ENABLED = process.env.FM_ANON !== '0';
// 匿名在时效内可查看的不同文件数上限
const ANON_LIMIT = Number(process.env.FM_ANON_LIMIT) || 20;
// 空闲多久后匿名访问额度失活并重置（分钟），默认 30
const ANON_IDLE = (Number(process.env.FM_ANON_IDLE_MIN) || 30) * 60 * 1000;

// 管理员凭据持久化文件：未用环境变量配置时，首次通过引导页设置并写入此文件（存于 ROOT 下，列表中隐藏）
const AUTH_FILE = '.fm-auth.json';
const CRED_FILE = path.join(ROOT, AUTH_FILE);
// 显式开放模式：未配置任何凭据且 FM_OPEN=1 时跳过登录引导，保持无鉴权访问
const OPEN_MODE = process.env.FM_OPEN === '1';

// 远端 WebDAV 挂载配置文件（存于 ROOT 下，含远端凭据，列表中隐藏且禁止直接访问）
const MOUNTS_FILE = '.fm-mounts.json';
const MOUNTS_PATH = path.join(ROOT, MOUNTS_FILE);
// 内置 WebDAV 服务端挂载前缀：外部客户端通过 http://host:PORT/__dav/ 挂载本机数据目录
const DAV_PREFIX = '/__dav';

// 目录大小缓存文件名（存放于 ROOT 下，列表中隐藏）
const SIZE_CACHE_NAME = '.dirsize-cache.json';

// 缩略图磁盘缓存目录
const THUMB_CACHE_DIR = path.join(ROOT, '.thumb-cache');
try { fs.mkdirSync(THUMB_CACHE_DIR, { recursive: true }); } catch(e) {}

const MIME = {
  // Web
  '.html':'text/html;charset=utf-8',
  '.htm':'text/html;charset=utf-8',
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
  '.heic':'image/heic',
  '.heif':'image/heif',
  // Video
  '.mp4':'video/mp4',
  '.webm':'video/webm',
  '.mkv':'video/x-matroska',
  '.avi':'video/x-msvideo',
  '.mov':'video/quicktime',
  '.wmv':'video/x-ms-wmv',
  '.flv':'video/x-flv',
  '.m4v':'video/mp4',
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
  '.mdx':'text/plain',
  '.yaml':'text/plain',
  '.yml':'text/plain',
  '.toml':'text/plain',
  '.ini':'text/plain',
  '.cfg':'text/plain',
  '.conf':'text/plain',
  '.env':'text/plain',
  '.log':'text/plain',
  '.sql':'text/plain',
  '.sh':'text/plain',
  '.bash':'text/plain',
  '.zsh':'text/plain',
  '.bat':'text/plain',
  '.cmd':'text/plain',
  '.ps1':'text/plain',
  '.py':'text/plain',
  '.rb':'text/plain',
  '.php':'text/plain',
  '.java':'text/plain',
  '.kt':'text/plain',
  '.kts':'text/plain',
  '.scala':'text/plain',
  '.groovy':'text/plain',
  '.gradle':'text/plain',
  '.c':'text/plain',
  '.cpp':'text/plain',
  '.cc':'text/plain',
  '.cxx':'text/plain',
  '.h':'text/plain',
  '.hpp':'text/plain',
  '.cs':'text/plain',
  '.go':'text/plain',
  '.rs':'text/plain',
  '.swift':'text/plain',
  '.m':'text/plain',
  '.mm':'text/plain',
  '.r':'text/plain',
  '.lua':'text/plain',
  '.pl':'text/plain',
  '.pm':'text/plain',
  '.dart':'text/plain',
  '.ex':'text/plain',
  '.exs':'text/plain',
  '.erl':'text/plain',
  '.hs':'text/plain',
  '.clj':'text/plain',
  '.lisp':'text/plain',
  '.ts':'text/plain',
  '.tsx':'text/plain',
  '.jsx':'text/plain',
  '.vue':'text/plain',
  '.svelte':'text/plain',
  '.astro':'text/plain',
  '.scss':'text/plain',
  '.sass':'text/plain',
  '.less':'text/plain',
  '.graphql':'text/plain',
  '.gql':'text/plain',
  '.proto':'text/plain',
  '.tf':'text/plain',
  '.dockerfile':'text/plain',
  '.gitignore':'text/plain',
  '.dockerignore':'text/plain',
  '.editorconfig':'text/plain',
  '.makefile':'text/plain',
  '.cmake':'text/plain',
};

module.exports = {
  PORT, ROOT, REAL_ROOT, SIZE_CACHE_NAME, THUMB_CACHE_DIR, MIME,
  ADMIN_USER, ADMIN_PASS, SESSION_SECRET, SESSION_TTL,
  ANON_ENABLED, ANON_LIMIT, ANON_IDLE,
  AUTH_FILE, CRED_FILE, OPEN_MODE,
  MOUNTS_FILE, MOUNTS_PATH, DAV_PREFIX,
};
