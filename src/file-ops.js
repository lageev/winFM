const fs = require('fs');
const path = require('path');
const { isInside } = require('./utils');

function copyRecursiveSync(src, dest) {
  const st = fs.lstatSync(src);
  if (st.isSymbolicLink()) {
    throw new Error('不支持复制符号链接');
  }
  if (st.isDirectory()) {
    if (isInside(path.resolve(src), path.resolve(dest))) {
      throw new Error('不能将目录复制到自身或子目录');
    }
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
  } else if (st.isFile()) {
    fs.copyFileSync(src, dest);
  } else {
    throw new Error('不支持复制该类型文件');
  }
}

function isTextFile(ext) {
  const textExts = ['.txt','.md','.log','.js','.ts','.jsx','.tsx','.vue','.py','.java','.c','.cpp','.h','.go','.rs','.css','.html','.json','.xml','.yaml','.yml','.sh','.bat','.csv','.sql','.rb','.php','.swift','.kt','.scala','.lua','.r','.m','.mm','.toml','.ini','.cfg','.conf','.env','.gitignore','.dockerignore','.makefile','.cmake'];
  return textExts.includes(ext) || ext === '.makefile';
}

function isImageFile(ext) {
  return ['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp','.ico','.tiff','.tif','.avif'].includes(ext);
}

function isVideoFile(ext) {
  return ['.mp4','.webm','.mkv','.avi','.mov','.wmv','.flv','.m4v','.ts','.mts','.3gp'].includes(ext);
}

function isAudioFile(ext) {
  return ['.mp3','.wav','.ogg','.aac','.flac','.m4a','.wma','.opus'].includes(ext);
}

function getIcon(name, isDir) {
  if (isDir) return '<md-icon class="fic fic-folder">folder</md-icon>';
  const ext = path.extname(name).toLowerCase();
  const map = {
    // Images
    '.jpg':['image','green'],'.jpeg':['image','green'],'.png':['image','green'],'.gif':['image','green'],'.webp':['image','green'],'.svg':['image','green'],'.bmp':['image','green'],'.ico':['image','green'],'.tiff':['image','green'],'.tif':['image','green'],'.avif':['image','green'],
    // Video
    '.mp4':['movie','violet'],'.webm':['movie','violet'],'.mkv':['movie','violet'],'.avi':['movie','violet'],'.mov':['movie','violet'],'.wmv':['movie','violet'],'.flv':['movie','violet'],'.m4v':['movie','violet'],'.ts':['movie','violet'],'.mts':['movie','violet'],'.3gp':['movie','violet'],
    // Audio
    '.mp3':['music_note','rose'],'.wav':['music_note','rose'],'.flac':['music_note','rose'],'.aac':['music_note','rose'],'.ogg':['music_note','rose'],'.m4a':['music_note','rose'],'.wma':['music_note','rose'],'.opus':['music_note','rose'],
    // Documents
    '.pdf':['picture_as_pdf','rose'],'.doc':['description','blue'],'.docx':['description','blue'],
    '.xls':['table_chart','green'],'.xlsx':['table_chart','green'],'.csv':['table_chart','green'],
    '.ppt':['slideshow','amber'],'.pptx':['slideshow','amber'],
    // Archives
    '.zip':['folder_zip','amber'],'.rar':['folder_zip','amber'],'.7z':['folder_zip','amber'],'.tar':['folder_zip','amber'],'.gz':['folder_zip','amber'],'.tgz':['folder_zip','amber'],'.bz2':['folder_zip','amber'],'.xz':['folder_zip','amber'],'.zst':['folder_zip','amber'],
    // Code
    '.html':['code','amber'],'.css':['code','blue'],'.js':['code','amber'],'.ts':['code','blue'],'.jsx':['code','cyan'],'.tsx':['code','cyan'],'.vue':['code','green'],
    '.json':['data_object','cyan'],'.xml':['code','cyan'],'.yaml':['code','cyan'],'.yml':['code','cyan'],
    '.py':['code','blue'],'.java':['code','rose'],'.go':['code','cyan'],'.rs':['code','amber'],'.c':['code','blue'],'.cpp':['code','blue'],'.h':['code','blue'],
    // Text
    '.txt':['description','blue'],'.md':['description','blue'],'.log':['description',''],
    // Executables / Installers
    '.exe':['terminal',''],'.msi':['terminal',''],'.sh':['terminal',''],'.bat':['terminal',''],
    '.apk':['phone_android','green'],'.ipa':['phone_iphone','cyan'],'.dmg':['laptop_mac',''],'.pkg':['laptop_mac',''],'.deb':['terminal',''],'.rpm':['terminal',''],'.appx':['desktop_windows','blue'],
    // Fonts
    '.ttf':['font_download','violet'],'.otf':['font_download','violet'],'.woff':['font_download','violet'],'.woff2':['font_download','violet'],'.eot':['font_download','violet'],
  };
  const m = map[ext] || ['draft',''];
  return '<md-icon class="fic' + (m[1] ? ' fic-' + m[1] : '') + '">' + m[0] + '</md-icon>';
}

module.exports = { copyRecursiveSync, isTextFile, isImageFile, isVideoFile, isAudioFile, getIcon };
