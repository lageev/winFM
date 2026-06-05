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
  const textExts = [
    '.txt','.md','.mdx','.log','.csv','.sql',
    '.js','.ts','.jsx','.tsx','.vue','.svelte','.astro',
    '.css','.scss','.sass','.less','.html','.htm',
    '.json','.xml','.yaml','.yml','.toml','.ini','.cfg','.conf','.env',
    '.py','.rb','.php','.java','.kt','.kts','.scala','.groovy','.gradle',
    '.c','.cpp','.cc','.cxx','.h','.hpp','.cs',
    '.go','.rs','.swift','.m','.mm','.r','.lua','.pl','.pm','.dart',
    '.ex','.exs','.erl','.hs','.clj','.lisp',
    '.sh','.bash','.zsh','.bat','.cmd','.ps1',
    '.graphql','.gql','.proto','.tf',
    '.dockerfile','.gitignore','.dockerignore','.editorconfig','.makefile','.cmake'
  ];
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
    '.exe':['terminal',''],'.msi':['terminal',''],'.sh':['terminal',''],'.bat':['terminal',''],
    '.apk':['android','green'],'.ipa':['phone_iphone','cyan'],'.dmg':['disc_full',''],'.pkg':['inventory_2',''],'.deb':['terminal',''],'.rpm':['terminal',''],'.appx':['desktop_windows','blue'],
    // Fonts
    '.ttf':['font_download','violet'],'.otf':['font_download','violet'],'.woff':['font_download','violet'],'.woff2':['font_download','violet'],'.eot':['font_download','violet'],
  };
  const m = map[ext] || ['draft',''];
  return '<md-icon class="fic' + (m[1] ? ' fic-' + m[1] : '') + '">' + m[0] + '</md-icon>';
}

module.exports = { copyRecursiveSync, isTextFile, isImageFile, isVideoFile, isAudioFile, getIcon };
