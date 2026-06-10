const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { isInside } = require('./utils');
const { SIZE_CACHE_NAME } = require('./config');

// 可预览的扩展名分类（不带点），同时注入前端使用，保持单一来源
// video 仅保留浏览器基本能播的格式
const PREVIEW = {
  image: ['jpg','jpeg','png','gif','webp','svg','bmp','ico','tiff','tif','avif'],
  video: ['mp4','webm','mkv','mov','m4v'],
  audio: ['mp3','wav','ogg','aac','flac','m4a','opus'],
  text: ['txt','md','markdown','log','csv','sql','json','js','ts','jsx','tsx','css','html','htm','xml',
    'yaml','yml','toml','ini','cfg','conf','env','sh','bash','py','rb','java','c','cpp','h','hpp','go','rs',
    'gitignore','dockerignore','dockerfile','makefile'],
};

function userError(msg) {
  const e = new Error(msg);
  e.expose = true;
  return e;
}

async function copySafe(src, dest) {
  const st = await fsp.lstat(src);
  if (st.isSymbolicLink()) throw userError('不支持复制符号链接');
  if (st.isDirectory() && isInside(path.resolve(src), path.resolve(dest))) {
    throw userError('不能将目录复制到自身或子目录');
  }
  await fsp.cp(src, dest, {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: async (s) => !(await fsp.lstat(s)).isSymbolicLink(),
  });
}

function getIcon(name, isDir) {
  if (isDir) return '<md-icon class="fic fic-folder">folder</md-icon>';
  const ext = path.extname(name).toLowerCase();
  const map = {
    // Images
    '.jpg':['image','green'],'.jpeg':['image','green'],'.png':['image','green'],'.gif':['image','green'],'.webp':['image','green'],'.svg':['image','green'],'.bmp':['image','green'],'.ico':['image','green'],'.tiff':['image','green'],'.tif':['image','green'],'.avif':['image','green'],
    // Video
    '.mp4':['movie','violet'],'.webm':['movie','violet'],'.mkv':['movie','violet'],'.avi':['movie','violet'],'.mov':['movie','violet'],'.wmv':['movie','violet'],'.flv':['movie','violet'],'.m4v':['movie','violet'],'.mts':['movie','violet'],'.3gp':['movie','violet'],
    // Audio
    '.mp3':['music_note','rose'],'.wav':['music_note','rose'],'.flac':['music_note','rose'],'.aac':['music_note','rose'],'.ogg':['music_note','rose'],'.m4a':['music_note','rose'],'.wma':['music_note','rose'],'.opus':['music_note','rose'],
    // Documents
    '.pdf':['picture_as_pdf','rose'],'.doc':['description','blue'],'.docx':['description','blue'],
    '.xls':['table_chart','green'],'.xlsx':['table_chart','green'],'.csv':['table_chart','green'],
    '.ppt':['slideshow','amber'],'.pptx':['slideshow','amber'],
    // Archives
    '.zip':['folder_zip','amber'],'.rar':['folder_zip','amber'],'.7z':['folder_zip','amber'],'.tar':['folder_zip','amber'],'.gz':['folder_zip','amber'],'.tgz':['folder_zip','amber'],'.bz2':['folder_zip','amber'],'.xz':['folder_zip','amber'],'.zst':['folder_zip','amber'],
    // Code
    '.html':['code','amber'],'.htm':['code','amber'],'.css':['code','blue'],'.scss':['code','blue'],'.sass':['code','blue'],'.less':['code','blue'],
    '.js':['code','amber'],'.ts':['code','blue'],'.jsx':['code','cyan'],'.tsx':['code','cyan'],'.vue':['code','green'],'.svelte':['code','rose'],'.astro':['code','violet'],
    '.json':['data_object','cyan'],'.xml':['code','cyan'],'.yaml':['code','cyan'],'.yml':['code','cyan'],'.toml':['code','cyan'],
    '.py':['code','blue'],'.java':['code','rose'],'.go':['code','cyan'],'.rs':['code','amber'],
    '.c':['code','blue'],'.cpp':['code','blue'],'.cc':['code','blue'],'.cxx':['code','blue'],'.h':['code','blue'],'.hpp':['code','blue'],'.cs':['code','violet'],
    '.rb':['code','rose'],'.php':['code','violet'],'.swift':['code','amber'],'.kt':['code','violet'],'.kts':['code','violet'],'.scala':['code','red'],
    '.groovy':['code','cyan'],'.gradle':['code','green'],'.dart':['code','cyan'],
    '.lua':['code','blue'],'.r':['code','blue'],'.pl':['code','blue'],'.pm':['code','blue'],
    '.ex':['code','violet'],'.exs':['code','violet'],'.erl':['code','red'],'.hs':['code','violet'],'.clj':['code','green'],'.lisp':['code','rose'],
    '.graphql':['code','rose'],'.gql':['code','rose'],'.proto':['code','cyan'],'.tf':['code','violet'],
    '.sql':['code','amber'],'.sh':['terminal',''],'.bash':['terminal',''],'.zsh':['terminal',''],'.bat':['terminal',''],'.cmd':['terminal',''],'.ps1':['terminal',''],
    '.dockerfile':['terminal','cyan'],'.makefile':['terminal',''],'.cmake':['terminal',''],
    '.ini':['settings',''],'.cfg':['settings',''],'.conf':['settings',''],'.env':['settings',''],'.editorconfig':['settings',''],
    '.gitignore':['settings',''],'.dockerignore':['settings',''],
    // Text
    '.txt':['description','blue'],'.md':['description','blue'],'.log':['description',''],
    // Executables / Installers
    '.exe':['terminal',''],'.msi':['terminal',''],
    '.apk':['android','green'],'.ipa':['phone_iphone','cyan'],'.dmg':['disc_full',''],'.pkg':['inventory_2',''],'.deb':['terminal',''],'.rpm':['terminal',''],'.appx':['desktop_windows','blue'],
    // Fonts
    '.ttf':['font_download','violet'],'.otf':['font_download','violet'],'.woff':['font_download','violet'],'.woff2':['font_download','violet'],'.eot':['font_download','violet'],
  };
  const m = map[ext] || ['draft',''];
  return '<md-icon class="fic' + (m[1] ? ' fic-' + m[1] : '') + '">' + m[0] + '</md-icon>';
}

async function getDirectorySizeAsync(dirPath) {
  let total = 0, fileCount = 0, dirCount = 0;
  let entries;
  try {
    const st = await fsp.lstat(dirPath);
    if (!st.isDirectory()) return { size: st.size, files: 1, dirs: 0 };
    entries = await fsp.readdir(dirPath, { withFileTypes: true });
  } catch(e) { return { size: 0, files: 0, dirs: 0 }; }
  // Process in batches to avoid too many concurrent handles
  for (let i = 0; i < entries.length; i += 50) {
    const batch = entries.slice(i, i + 50);
    const results = await Promise.all(batch.map(async function(entry) {
      const full = path.join(dirPath, entry.name);
      if (entry.isSymbolicLink() || entry.name === SIZE_CACHE_NAME) return null;
      try {
        const st = await fsp.lstat(full);
        if (st.isDirectory()) {
          const sub = await getDirectorySizeAsync(full);
          return { size: sub.size, files: sub.files, dirs: 1 + sub.dirs };
        } else if (st.isFile()) {
          return { size: st.size, files: 1, dirs: 0 };
        }
      } catch(e) {}
      return null;
    }));
    for (const r of results) {
      if (!r) continue;
      total += r.size;
      fileCount += r.files;
      dirCount += r.dirs;
    }
  }
  return { size: total, files: fileCount, dirs: dirCount };
}

module.exports = { PREVIEW, copySafe, getIcon, getDirectorySizeAsync };
