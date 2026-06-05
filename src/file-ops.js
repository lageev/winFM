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
  return ['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp','.ico'].includes(ext);
}

function isVideoFile(ext) {
  return ['.mp4','.webm','.ogg'].includes(ext);
}

function isAudioFile(ext) {
  return ['.mp3','.wav','.ogg','.aac','.flac'].includes(ext);
}

function getIcon(name, isDir) {
  if (isDir) return '<i data-lucide="folder" class="fic fic-blue"></i>';
  const ext = path.extname(name).toLowerCase();
  const map = {
    '.jpg':['image','green'],'.jpeg':['image','green'],'.png':['image','green'],'.gif':['image','green'],'.webp':['image','green'],'.svg':['image','green'],'.bmp':['image','green'],
    '.mp4':['film','violet'],'.avi':['film','violet'],'.mkv':['film','violet'],'.mov':['film','violet'],'.wmv':['film','violet'],
    '.mp3':['music','rose'],'.wav':['music','rose'],'.flac':['music','rose'],'.aac':['music','rose'],'.ogg':['music','rose'],
    '.pdf':['file-text','rose'],'.doc':['file-text','blue'],'.docx':['file-text','blue'],
    '.xls':['file-spreadsheet','green'],'.xlsx':['file-spreadsheet','green'],'.csv':['file-spreadsheet','green'],
    '.ppt':['presentation','amber'],'.pptx':['presentation','amber'],
    '.zip':['file-archive','amber'],'.rar':['file-archive','amber'],'.7z':['file-archive','amber'],'.tar':['file-archive','amber'],'.gz':['file-archive','amber'],
    '.html':['file-code','amber'],'.css':['file-code','blue'],'.js':['file-code','amber'],'.ts':['file-code','blue'],
    '.json':['file-code','cyan'],'.xml':['file-code','cyan'],'.yaml':['file-code','cyan'],'.yml':['file-code','cyan'],
    '.py':['file-code','blue'],'.java':['file-code','rose'],'.go':['file-code','cyan'],'.rs':['file-code','amber'],'.c':['file-code','blue'],'.cpp':['file-code','blue'],
    '.txt':['file-text','blue'],'.md':['file-text','blue'],'.log':['file-text',''],
    '.exe':['terminal',''],'.sh':['terminal',''],'.bat':['terminal',''],
  };
  const m = map[ext] || ['file',''];
  return '<i data-lucide="' + m[0] + '" class="fic' + (m[1] ? ' fic-' + m[1] : '') + '"></i>';
}

module.exports = { copyRecursiveSync, isTextFile, isImageFile, isVideoFile, isAudioFile, getIcon };
