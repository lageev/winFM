const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = 8888;
const ROOT = path.resolve('/data');
try { fs.mkdirSync(ROOT, { recursive: true }); } catch(e) {}
const REAL_ROOT = fs.realpathSync(ROOT);

const MIME = {'.html':'text/html;charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.pdf':'application/pdf','.zip':'application/zip','.txt':'text/plain;charset=utf-8','.md':'text/plain;charset=utf-8','.mp4':'video/mp4','.webm':'video/webm','.mp3':'audio/mpeg','.wav':'audio/wav','.ico':'image/x-icon','.webp':'image/webp','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.csv':'text/csv;charset=utf-8','.xml':'text/xml','.yaml':'text/plain','.yml':'text/plain','.log':'text/plain','.sh':'text/plain','.py':'text/plain','.java':'text/plain','.c':'text/plain','.cpp':'text/plain','.h':'text/plain','.go':'text/plain','.rs':'text/plain','.ts':'text/plain','.tsx':'text/plain','.jsx':'text/plain','.vue':'text/plain'};

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function isInside(base, target){
  const rel = path.relative(base, target);
  return rel === '' || (!!rel && !rel.startsWith('..') && !path.isAbsolute(rel));
}

function safeDecodeURIComponent(value){
  if(typeof value !== 'string') return null;
  try{ return decodeURIComponent(value); }
  catch(e){ return null; }
}

function safePath(rp){
  if(typeof rp !== 'string') return null;
  const normalized = rp.replace(/\\/g, '/');
  const requestPath = normalized.startsWith('/') ? normalized : '/' + normalized;
  const fp = path.resolve(ROOT, '.' + requestPath);
  if(!isInside(ROOT, fp)) return null;
  return fp;
}

function pathExists(fp){
  try{ fs.lstatSync(fp); return true; }
  catch(e){
    if(e && e.code === 'ENOENT') return false;
    throw e;
  }
}

function realPathInsideRoot(fp){
  try{ return isInside(REAL_ROOT, fs.realpathSync(fp)); }
  catch(e){ return false; }
}

function ensureSafeDirectory(fp){
  if(!fp || !isInside(ROOT, fp)) return false;
  try{
    const st = fs.statSync(fp);
    return st.isDirectory() && realPathInsideRoot(fp);
  }catch(e){
    return false;
  }
}

function safeName(name){
  if(typeof name !== 'string') return null;
  if(name.length === 0 || name === '.' || name === '..') return null;
  if(name.includes('/') || name.includes('\\') || name.includes('\0')) return null;
  return name;
}

function safeChildPath(dir, name){
  const cleanName = safeName(name);
  if(!cleanName) return null;
  const fp = path.join(dir, cleanName);
  return isInside(ROOT, fp) ? fp : null;
}

function safeUploadedFilename(rawName){
  if(typeof rawName !== 'string') return null;
  const basename = rawName.replace(/\\/g, '/').split('/').pop();
  return safeName(basename);
}

function getSafePathParam(value){
  const decoded = safeDecodeURIComponent(value);
  return decoded === null ? null : safePath(decoded);
}

function attachmentDisposition(filename){
  const asciiName = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return "attachment; filename=\""+asciiName+"\"; filename*=UTF-8''"+encodeURIComponent(filename);
}

function itemHref(name, isDir){
  return encodeURIComponent(name) + (isDir ? '/' : '');
}

function uiIcon(name, fallback){
  return '<i data-lucide="'+name+'" class="ui-icon" aria-hidden="true">'+fallback+'</i>';
}

function formatSize(bytes){
  if(bytes===0) return '0 B';
  const k=1024,sizes=['B','KB','MB','GB','TB'];
  const i=Math.min(Math.floor(Math.log(bytes)/Math.log(k)), sizes.length - 1);
  return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+' '+sizes[i];
}

function getIcon(name, isDir){
  if(isDir) return '📁';
  const ext = path.extname(name).toLowerCase();
  const map = {
    '.jpg':'🖼️','.jpeg':'🖼️','.png':'🖼️','.gif':'🖼️','.webp':'🖼️','.svg':'🖼️','.bmp':'🖼️',
    '.mp4':'🎬','.avi':'🎬','.mkv':'🎬','.mov':'🎬','.wmv':'🎬',
    '.mp3':'🎵','.wav':'🎵','.flac':'🎵','.aac':'🎵','.ogg':'🎵',
    '.pdf':'📕','.doc':'📘','.docx':'📘','.xls':'📗','.xlsx':'📗','.ppt':'📙','.pptx':'📙',
    '.zip':'📦','.rar':'📦','.7z':'📦','.tar':'📦','.gz':'📦',
    '.html':'🌐','.css':'🎨','.js':'⚡','.ts':'⚡','.json':'📋','.xml':'📋',
    '.py':'🐍','.java':'☕','.go':'🔵','.rs':'🦀','.c':'⚙️','.cpp':'⚙️',
    '.txt':'📝','.md':'📝','.log':'📝',
    '.exe':'⚡','.sh':'⚡','.bat':'⚡',
    '.csv':'📊','.yaml':'📋','.yml':'📋',
  };
  return map[ext] || '📄';
}

function isTextFile(ext){
  const textExts = ['.txt','.md','.log','.js','.ts','.jsx','.tsx','.vue','.py','.java','.c','.cpp','.h','.go','.rs','.css','.html','.json','.xml','.yaml','.yml','.sh','.bat','.csv','.sql','.rb','.php','.swift','.kt','.scala','.lua','.r','.m','.mm','.toml','.ini','.cfg','.conf','.env','.gitignore','.dockerignore','.makefile','.cmake'];
  return textExts.includes(ext) || ext === '.makefile';
}

function isImageFile(ext){
  return ['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp','.ico'].includes(ext);
}

function isVideoFile(ext){
  return ['.mp4','.webm','.ogg'].includes(ext);
}

function isAudioFile(ext){
  return ['.mp3','.wav','.ogg','.aac','.flac'].includes(ext);
}

function getHTML(list, rp, msg, sortField, sortDir, groupDirs){
  sortField = sortField || 'name';
  sortDir = sortDir || 'asc';
  groupDirs = groupDirs !== false;

  function sortUrl(field){
    let dir = 'asc';
    if(field === sortField) dir = sortDir === 'asc' ? 'desc' : 'asc';
    let url = '?sort=' + field + '&dir=' + dir;
    if(!groupDirs) url += '&group=0';
    return url;
  }
  function sortIcon(field){
    if(field !== sortField) return '<span class="sort-icon">▲</span>';
    return '<span class="sort-icon">' + (sortDir === 'asc' ? '▲' : '▼') + '</span>';
  }
  function sortClass(field){
    return field === sortField ? ' sort-active' : '';
  }

  const breadcrumbs = rp.split('/').filter(Boolean);
  let breadcrumbHtml = '<a href="/" class="breadcrumb-item">🏠 根目录</a>';
  const cumParts = [];
  for(const b of breadcrumbs){
    cumParts.push(b);
    const href = '/' + cumParts.map(encodeURIComponent).join('/') + '/';
    breadcrumbHtml += '<span class="breadcrumb-sep">/</span><a href="'+href+'" class="breadcrumb-item">'+esc(b)+'</a>';
  }

  const msgHtml = msg ? '<div class="alert '+(msg.type === 'success' ? 'alert-success' : 'alert-error')+' mb-4">'+esc(msg.text)+'</div>' : '';
  const dirCount = list.filter(i => i.isDir).length;
  const fileCount = list.length - dirCount;
  const totalBytes = list.reduce((sum, i) => sum + (i.isDir ? 0 : i.size), 0);
  const currentLabel = breadcrumbs.length ? breadcrumbs[breadcrumbs.length - 1] : '根目录';
  const statsHtml = '<div class="header-stats">'+
    '<span class="badge badge-outline gap-1"><b>'+dirCount+'</b> 文件夹</span>'+
    '<span class="badge badge-outline gap-1"><b>'+fileCount+'</b> 文件</span>'+
    '<span class="badge badge-outline gap-1"><b>'+formatSize(totalBytes)+'</b></span>'+
    '</div>';

  const listHtml = list.map(i=>{
    const href = itemHref(i.name, i.isDir);
    const icon = getIcon(i.name, i.isDir);
    const size = i.isDir ? '-' : formatSize(i.size);
    const mtime = i.mtime ? new Date(i.mtime).toLocaleString('zh-CN') : '-';
    const encodedName = encodeURIComponent(i.name);
    const dlBtn = i.isDir ? '' : '<a href="'+encodedName+'?download=1" class="btn btn-ghost btn-xs btn-square" title="下载" aria-label="下载">'+uiIcon('download','⬇')+'</a>';
    const previewBtn = i.isDir ? '' : '<button class="btn btn-ghost btn-xs btn-square act-btn" data-act="preview" data-name="'+esc(i.name)+'" title="预览" aria-label="预览">'+uiIcon('eye','👁')+'</button>';
    const dn = esc(i.name);
    return '<tr class="file-row" data-name="'+dn+'">'+
      '<td class="col-check"><input type="checkbox" class="checkbox checkbox-primary checkbox-sm row-cb" data-name="'+dn+'"></td>'+
      '<td class="col-icon file-icon">'+icon+'</td>'+
      '<td class="col-name file-name"><a href="'+href+'">'+dn+'</a></td>'+
      '<td class="col-size file-size">'+size+'</td>'+
      '<td class="col-time file-time">'+mtime+'</td>'+
      '<td class="col-actions file-actions">'+previewBtn+dlBtn+
        '<button class="btn btn-ghost btn-xs btn-square act-btn" data-act="rename" data-name="'+dn+'" title="重命名" aria-label="重命名">'+uiIcon('pencil','✎')+'</button>'+
        '<button class="btn btn-ghost btn-xs btn-square act-btn" data-act="move" data-name="'+dn+'" title="移动" aria-label="移动">'+uiIcon('folder-input','↪')+'</button>'+
        '<button class="btn btn-ghost btn-xs btn-square act-btn" data-act="copy" data-name="'+dn+'" title="复制" aria-label="复制">'+uiIcon('copy','⧉')+'</button>'+
        '<button class="btn btn-ghost btn-xs btn-square text-error act-btn" data-act="delete" data-name="'+dn+'" title="删除" aria-label="删除">'+uiIcon('trash-2','×')+'</button></td>'+
      '</tr>';
  }).join('');

  const emptyHtml = list.length === 0 ? '<div class="empty">📂 空目录，上传文件或新建文件夹开始使用</div>' : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f7f8fb">
<title>文件管理</title>
<link href="https://cdn.jsdelivr.net/npm/daisyui@5" rel="stylesheet" type="text/css">
<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<script>
(function(){
  var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
})();
</script>
<style>
:root{
  color-scheme:light;
  --bg:#f7f8fb;
  --bg-soft:#eef2f7;
  --surface:rgba(255,255,255,0.86);
  --surface-strong:#ffffff;
  --surface-hover:#f3f7fb;
  --text:#172033;
  --muted:#64748b;
  --faint:#94a3b8;
  --line:#d9e1ec;
  --line-soft:#edf1f6;
  --accent:#2563eb;
  --accent-strong:#1d4ed8;
  --accent-soft:#dbeafe;
  --teal:#0f766e;
  --teal-soft:#ccfbf1;
  --amber:#b45309;
  --amber-soft:#fef3c7;
  --danger:#dc2626;
  --danger-soft:#fee2e2;
  --shadow:0 18px 60px rgba(15,23,42,0.10);
  --shadow-soft:0 1px 2px rgba(15,23,42,0.06),0 10px 28px rgba(15,23,42,0.07);
  --radius:8px;
  --radius-sm:6px;
}
@media(prefers-color-scheme:dark){
  :root{
    color-scheme:dark;
    --bg:#0d1117;
    --bg-soft:#111827;
    --surface:rgba(17,24,39,0.82);
    --surface-strong:#121a27;
    --surface-hover:#172235;
    --text:#e5edf8;
    --muted:#9aa7b8;
    --faint:#718096;
    --line:#263447;
    --line-soft:#1d2938;
    --accent:#60a5fa;
    --accent-strong:#93c5fd;
    --accent-soft:#14325d;
    --teal:#2dd4bf;
    --teal-soft:#103a38;
    --amber:#f59e0b;
    --amber-soft:#3a2a12;
    --danger:#f87171;
    --danger-soft:#3f171b;
    --shadow:0 18px 60px rgba(0,0,0,0.34);
    --shadow-soft:0 1px 1px rgba(0,0,0,0.28),0 14px 36px rgba(0,0,0,0.22);
  }
}
*{margin:0;padding:0;box-sizing:border-box}
html{background:var(--bg);text-size-adjust:100%}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:linear-gradient(180deg,var(--bg),var(--bg-soft));color:var(--text);min-height:100vh;letter-spacing:0}
button,input,a{font:inherit}
.header{position:sticky;top:0;z-index:100;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;padding:14px 24px;border-bottom:1px solid var(--line);background:var(--surface);backdrop-filter:saturate(160%) blur(18px);box-shadow:0 1px 0 rgba(255,255,255,0.35)}
.header-main{display:flex;align-items:center;gap:18px;min-width:0}
.brand{display:flex;align-items:center;gap:10px;min-width:max-content}
.brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:var(--radius);background:linear-gradient(135deg,var(--accent),var(--teal));color:white;font-size:17px;box-shadow:0 10px 22px rgba(37,99,235,0.22)}
.brand-copy{display:flex;flex-direction:column;gap:1px}
.header h1{font-size:18px;line-height:1.2;font-weight:720;color:var(--text);white-space:nowrap}
.subtitle{font-size:12px;color:var(--muted);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.breadcrumb{display:flex;align-items:center;flex-wrap:wrap;gap:4px;min-width:0}
.breadcrumb-item{color:var(--muted);text-decoration:none;font-size:13px;padding:5px 8px;border-radius:var(--radius-sm);transition:background .16s,color .16s,box-shadow .16s}
.breadcrumb-item:hover{background:var(--accent-soft);color:var(--accent-strong)}
.breadcrumb-sep{color:var(--faint);font-size:12px}
.header-stats{display:flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.page-container{position:relative;max-width:1240px;margin:0 auto;padding:22px}
.toolbar{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center;padding:8px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);box-shadow:var(--shadow-soft);backdrop-filter:saturate(150%) blur(14px)}
.ui-icon{display:inline-block;width:1em;height:1em;vertical-align:-.125em;flex-shrink:0}
.ui-icon svg{width:1em;height:1em}
.breadcrumb-item:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.table-wrap{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;backdrop-filter:saturate(145%) blur(12px)}
table{width:100%;border-collapse:separate;border-spacing:0}
th{background:var(--surface-strong);border-bottom:1px solid var(--line);padding:11px 14px;text-align:left;font-weight:650;font-size:12px;color:var(--muted);text-transform:none;letter-spacing:0}
td{padding:9px 14px;border-bottom:1px solid var(--line-soft);font-size:13px;vertical-align:middle}
tr:last-child td{border-bottom:none}
.file-row{transition:background .14s}
.file-row:hover{background:var(--surface-hover)}
.file-icon{font-size:18px;width:40px;text-align:center;filter:saturate(.9)}
.file-name a{color:var(--text);text-decoration:none;word-break:break-word;font-weight:540}
.file-name a:hover{color:var(--accent-strong);text-decoration:none}
.file-size,.file-time{color:var(--muted);font-size:12px;white-space:nowrap}
.file-actions{display:flex;gap:5px;white-space:nowrap;justify-content:flex-end}
.empty{text-align:center;padding:72px 20px;color:var(--muted);font-size:15px;background:linear-gradient(180deg,transparent,var(--surface-hover))}
.modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(3,7,18,0.52);z-index:200;justify-content:center;align-items:center;padding:18px;backdrop-filter:blur(10px)}
.modal-overlay.show{display:flex}
.dialog-panel{background:var(--surface-strong);border:1px solid var(--line);border-radius:var(--radius);padding:22px;min-width:400px;max-width:520px;width:90%;box-shadow:var(--shadow)}
.dialog-panel h2{font-size:17px;margin-bottom:16px;color:var(--text);font-weight:720}
.dialog-panel .input{margin-bottom:16px}
.modal-actions{display:flex;gap:8px;justify-content:flex-end}
.upload-area{border:1.5px dashed var(--accent);border-color:color-mix(in srgb,var(--accent) 42%,var(--line));border-radius:var(--radius);padding:42px;text-align:center;cursor:pointer;transition:background .16s,border-color .16s,transform .16s;margin-bottom:16px;background:linear-gradient(180deg,var(--surface),var(--surface-hover))}
.upload-area:hover,.upload-area.dragover{border-color:var(--accent);background:var(--accent-soft)}
.upload-area.dragover{transform:scale(1.01)}
.upload-area p{color:var(--text);margin-top:8px;font-size:14px;font-weight:600}
.upload-area .icon{font-size:46px}
.drop-zone-hint{font-size:12px;color:var(--muted);margin-top:4px}
#uploadProgress>div{background:var(--line-soft)!important;border-radius:999px!important}
#progressBar{background:linear-gradient(90deg,var(--accent),var(--teal))!important;border-radius:999px}
#progressText{color:var(--muted)!important}
.preview-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(3,7,18,0.88);z-index:300;justify-content:center;align-items:center;flex-direction:column;padding:24px;backdrop-filter:blur(12px)}
.preview-overlay.show{display:flex}
.preview-overlay img,.preview-overlay video,.preview-overlay audio{max-width:min(92vw,1200px);max-height:80vh;border-radius:var(--radius);box-shadow:0 20px 80px rgba(0,0,0,0.42)}
.preview-overlay pre{background:#0b1020;color:#dbeafe;border:1px solid rgba(148,163,184,0.22);padding:20px;border-radius:var(--radius);max-width:min(92vw,1100px);max-height:80vh;overflow:auto;font-size:13px;line-height:1.65;white-space:pre-wrap;word-break:break-word;box-shadow:0 20px 80px rgba(0,0,0,0.34)}
.preview-close{position:absolute;top:18px;right:24px;color:#fff;font-size:30px;cursor:pointer;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16);border-radius:var(--radius);z-index:301;width:42px;height:42px;line-height:1}
.preview-close:hover{background:rgba(255,255,255,0.16)}
.preview-name{color:#e5edf8;margin-top:12px;font-size:14px;max-width:90vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fb-item{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background .15s;border-bottom:1px solid var(--line-soft);font-size:14px}
.fb-item:last-child{border-bottom:none}
.fb-item:hover{background:var(--surface-hover)}
.fb-icon{font-size:16px;flex-shrink:0}
.clipboard-bar{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:var(--radius);margin-bottom:14px;font-size:13px;flex-wrap:wrap;border:1px solid var(--line);box-shadow:var(--shadow-soft)}
.clipboard-bar.move{background:var(--amber-soft);border-color:var(--amber);border-color:color-mix(in srgb,var(--amber) 34%,var(--line));color:var(--amber)}
.clipboard-bar.copy{background:var(--accent-soft);border-color:var(--accent);border-color:color-mix(in srgb,var(--accent) 34%,var(--line));color:var(--accent-strong)}
.app-toast{position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-6px);padding:12px 18px;border-radius:var(--radius);font-size:13px;z-index:999;opacity:0;transition:opacity .24s,transform .24s;pointer-events:none;box-shadow:var(--shadow);border:1px solid rgba(255,255,255,0.18);font-weight:560}
.app-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.app-toast.success{background:var(--teal);color:#fff}
.app-toast.info{background:var(--accent);color:#fff}
.col-check{width:36px;text-align:center}
.col-check input[type=checkbox]{width:16px;height:16px;cursor:pointer;accent-color:var(--accent)}
.sortable{cursor:pointer;user-select:none;transition:background .15s;position:relative}
.sortable:hover{background:var(--surface-hover)}
.sortable a{color:var(--muted);text-decoration:none;display:inline-flex;align-items:center;gap:4px}
.sortable a:hover{color:var(--accent-strong)}
.sortable .sort-icon{font-size:10px;color:var(--accent)}
.sortable:not(.sort-active) .sort-icon{opacity:.35}
tr.selected{background:var(--accent-soft)!important}
.batch-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(135deg,var(--accent),var(--teal));color:#fff;border-radius:var(--radius);margin-bottom:14px;font-size:13px;flex-wrap:wrap;box-shadow:var(--shadow-soft)}
.batch-bar b{font-size:14px}
.batch-bar .btn{color:#fff}
@media(max-width:860px){
  .header{grid-template-columns:1fr;align-items:start;padding:12px 14px;gap:10px}
  .header-main{align-items:flex-start;flex-direction:column;gap:9px}
  .brand{width:100%;justify-content:flex-start}
  .subtitle{max-width:70vw}
  .header-stats{justify-content:flex-start}
  .breadcrumb{font-size:12px}
  .breadcrumb-item{padding:3px 6px;font-size:12px}
  .page-container{padding:14px}
  .toolbar{gap:6px;padding:6px}
  .toolbar .btn{min-height:34px}
  table{table-layout:fixed}
  th,td{padding:8px 6px;font-size:12px}
  .col-size,.col-time{display:none}
  .col-icon{width:32px}
  .col-name{overflow:hidden;text-overflow:ellipsis}
  .col-actions{width:auto}
  .col-check{width:28px}
  .col-check input[type=checkbox]{width:14px;height:14px}
  .file-name a{font-size:13px}
  .file-actions{gap:3px;flex-wrap:wrap;justify-content:flex-start}
  .file-actions .btn-sm{padding:4px 6px;font-size:12px;border-radius:var(--radius-sm)}
  .dialog-panel{min-width:auto!important;width:100%!important;padding:16px}
  .upload-area{padding:32px 18px}
  .clipboard-bar{padding:8px 10px;font-size:12px;gap:8px}
  .clipboard-bar .hide-mobile{display:none}
  .app-toast{font-size:12px;padding:10px 14px;max-width:90%}
}
</style>
</head>
<body>
<div id="toast" class="app-toast"></div>
<div class="header">
  <div class="header-main">
    <div class="brand">
      <div class="brand-mark">${uiIcon('folders','▣')}</div>
      <div class="brand-copy">
        <h1>文件管理</h1>
        <div class="subtitle">${esc(currentLabel)}</div>
      </div>
    </div>
    <div class="breadcrumb">${breadcrumbHtml}</div>
  </div>
  ${statsHtml}
</div>
<div class="page-container">
  ${msgHtml}
  <div class="toolbar">
    <button class="btn btn-primary" onclick="showUpload()">${uiIcon('upload-cloud','⇧')}<span>上传文件</span></button>
    <button class="btn btn-outline" onclick="showNewFolder()">${uiIcon('folder-plus','＋')}<span>新建文件夹</span></button>
    <button class="btn btn-outline" onclick="location.reload()">${uiIcon('refresh-cw','↻')}<span>刷新</span></button>
    <a href="?sort=${sortField}&dir=${sortDir}&group=${groupDirs?0:1}" class="btn ${groupDirs?'btn-neutral':'btn-outline'}" title="切换目录优先显示">${uiIcon('folder-tree','▤')}<span>目录优先</span></a>
    <span id="toolbarPaste"></span>
  </div>
  <div id="batchBar"></div>
  <div id="clipboardBar"></div>
  <div class="table-wrap">
    <table class="table table-zebra table-sm">
      <thead><tr><th class="col-check" style="width:36px"><input type="checkbox" id="selectAll" class="checkbox checkbox-primary checkbox-sm"></th><th class="col-icon" style="width:40px"></th><th class="col-name sortable${sortClass('name')}"><a href="${sortUrl('name')}">名称${sortIcon('name')}</a></th><th class="col-size sortable${sortClass('size')}" style="width:80px"><a href="${sortUrl('size')}">大小${sortIcon('size')}</a></th><th class="col-time sortable${sortClass('mtime')}" style="width:160px"><a href="${sortUrl('mtime')}">修改时间${sortIcon('mtime')}</a></th><th class="col-actions" style="width:220px">操作</th></tr></thead>
      <tbody>
        ${rp !== '/' ? '<tr class="file-row"><td class="col-check"></td><td class="col-icon">⬆️</td><td class="col-name"><a href="../">返回上级</a></td><td class="col-size">-</td><td class="col-time">-</td><td class="col-actions"></td></tr>' : ''}
        ${listHtml}
      </tbody>
    </table>
    ${emptyHtml}
  </div>
</div>

<!-- Upload Modal -->
<div class="modal-overlay" id="uploadModal">
  <div class="dialog-panel">
    <h2>📤 上传文件</h2>
    <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()">
      <div class="icon">📁</div>
      <p>点击选择文件，或拖拽文件到这里</p>
      <div class="drop-zone-hint">支持多文件上传</div>
    </div>
    <input type="file" id="fileInput" multiple style="display:none">
    <div id="uploadProgress" style="display:none">
      <div style="background:#f0f0f0;border-radius:8px;overflow:hidden;height:8px;margin-bottom:8px">
        <div id="progressBar" style="background:var(--accent);height:100%;width:0%;transition:width 0.3s"></div>
      </div>
      <div id="progressText" style="font-size:13px;color:#999;text-align:center"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('uploadModal')">取消</button>
    </div>
  </div>
</div>

<!-- New Folder Modal -->
<div class="modal-overlay" id="folderModal">
  <div class="dialog-panel">
    <h2>📁 新建文件夹</h2>
    <input type="text" id="folderName" class="input input-bordered w-full" placeholder="输入文件夹名称">
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('folderModal')">取消</button>
      <button class="btn btn-primary" onclick="createFolder()">创建</button>
    </div>
  </div>
</div>

<!-- Rename Modal -->
<div class="modal-overlay" id="renameModal">
  <div class="dialog-panel">
    <h2>✏️ 重命名</h2>
    <div id="renameOldName" style="font-size:13px;color:#999;margin-bottom:12px;word-break:break-all"></div>
    <input type="text" id="renameNewName" class="input input-bordered w-full" placeholder="输入新名称">
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('renameModal')">取消</button>
      <button class="btn btn-primary" onclick="doRename()">确定</button>
    </div>
  </div>
</div>

<!-- Preview Modal -->
<div class="preview-overlay" id="previewOverlay">
  <button class="preview-close" onclick="closePreview()">✕</button>
  <div id="previewContent"></div>
  <div class="preview-name" id="previewName"></div>
</div>

<script>
const currentPath = location.pathname;
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function iconHtml(name, fallback){return '<i data-lucide="'+name+'" class="ui-icon" aria-hidden="true">'+fallback+'</i>'}
function renderIcons(){try{if(window.lucide) window.lucide.createIcons()}catch(e){}}

function showUpload(){document.getElementById('uploadModal').classList.add('show')}
function showNewFolder(){document.getElementById('folderModal').classList.add('show');document.getElementById('folderName').focus()}
function closeModal(id){document.getElementById(id).classList.remove('show')}

function closePreview(){document.getElementById('previewOverlay').classList.remove('show');document.getElementById('previewContent').innerHTML=''}

document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal('uploadModal');closeModal('folderModal');closeModal('renameModal');closePreview()}});

// Event delegation for action buttons
document.addEventListener('click', function(e){
  const btn = e.target.closest('.act-btn');
  if(!btn) return;
  const act = btn.dataset.act;
  const name = btn.dataset.name;
  if(act === 'rename') showRename(name);
  else if(act === 'preview') previewFile(name);
  else if(act === 'move') setClipboard(name, 'move');
  else if(act === 'copy') setClipboard(name, 'copy');
  else if(act === 'delete') deleteItem(name);
  else if(act === 'paste') doPaste();
  else if(act === 'cancel-clip') clearClipboard();
  else if(act === 'batch-delete') batchDelete();
  else if(act === 'batch-move') batchMove();
  else if(act === 'batch-copy') batchCopy();
  else if(act === 'batch-download') batchDownload();
  else if(act === 'batch-clear') clearSelection();
});

// Multi-select & batch operations
var selectedItems = new Set();

function clearSelection(){
  selectedItems.clear();
  refreshSelection();
}

function updateBatchBar(){
  var bar = document.getElementById('batchBar');
  if(!bar) return;
  if(selectedItems.size === 0){ bar.innerHTML = ''; return; }
  var n = selectedItems.size;
  bar.innerHTML = '<div class="batch-bar">'+
    '<span>已选 <b>'+n+'</b> 项</span>'+
    '<button class="btn btn-sm btn-ghost act-btn" data-act="batch-download">'+iconHtml('archive','▣')+' 打包下载</button>'+
    '<button class="btn btn-sm btn-ghost act-btn" data-act="batch-copy">'+iconHtml('copy','⧉')+' 批量复制</button>'+
    '<button class="btn btn-sm btn-ghost act-btn" data-act="batch-move">'+iconHtml('folder-input','↪')+' 批量移动</button>'+
    '<button class="btn btn-sm btn-error act-btn" data-act="batch-delete">'+iconHtml('trash-2','×')+' 批量删除</button>'+
    '<button class="btn btn-sm btn-ghost act-btn" data-act="batch-clear" style="margin-left:auto">'+iconHtml('x','×')+' 取消选择</button>'+
    '</div>';
  renderIcons();
}

function refreshSelection(){
  var cbs = document.querySelectorAll('.row-cb');
  for(var i=0;i<cbs.length;i++){
    var name = cbs[i].dataset.name;
    var row = cbs[i].closest('tr');
    if(selectedItems.has(name)){
      cbs[i].checked = true;
      if(row) row.classList.add('selected');
    } else {
      cbs[i].checked = false;
      if(row) row.classList.remove('selected');
    }
  }
  var selectAll = document.getElementById('selectAll');
  if(selectAll) selectAll.checked = cbs.length > 0 && selectedItems.size === cbs.length;
  updateBatchBar();
}

// Select all checkbox
document.addEventListener('change', function(e){
  if(e.target.id === 'selectAll'){
    var cbs = document.querySelectorAll('.row-cb');
    selectedItems.clear();
    if(e.target.checked){
      for(var i=0;i<cbs.length;i++) selectedItems.add(cbs[i].dataset.name);
    }
    refreshSelection();
    return;
  }
  if(e.target.classList.contains('row-cb')){
    var name = e.target.dataset.name;
    var row = e.target.closest('tr');
    if(e.target.checked){
      selectedItems.add(name);
      if(row) row.classList.add('selected');
    } else {
      selectedItems.delete(name);
      if(row) row.classList.remove('selected');
    }
    updateBatchBar();
    var selectAll = document.getElementById('selectAll');
    var cbs = document.querySelectorAll('.row-cb');
    if(selectAll) selectAll.checked = cbs.length > 0 && selectedItems.size === cbs.length;
  }
});

async function batchDownload(){
  var names = Array.from(selectedItems);
  if(!names.length) return;
  showToast('正在打包 '+names.length+' 项，请稍候...', 'info');
  try{
    var r = await fetch(currentPath + '?action=batchdownload&names=' + encodeURIComponent(JSON.stringify(names)), {method:'POST'});
    if(!r.ok){ var t=await r.text(); showToast('打包失败: '+t,'info'); return; }
    var blob = await r.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var dirName = currentPath.replace(/[/]$/,'').split('/').pop() || 'files';
    try{ dirName = decodeURIComponent(dirName) || 'files'; }catch(e){}
    a.download = dirName + '.zip';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 60000);
    showToast('打包下载完成','success');
  }catch(e){ showToast('下载失败','info'); }
}

async function batchDelete(){
  var names = Array.from(selectedItems);
  if(!confirm('确定删除选中的 '+names.length+' 项吗？此操作不可恢复。')) return;
  var ok = 0, fail = 0;
  for(var i=0;i<names.length;i++){
    try{
      var r = await fetch(currentPath + '?action=delete&name=' + encodeURIComponent(names[i]), {method:'POST'});
      if(r.ok) ok++; else fail++;
    }catch(e){ fail++; }
  }
  selectedItems.clear();
  showToast('删除完成：成功 '+ok+'，失败 '+fail, fail > 0 ? 'info' : 'success');
  setTimeout(function(){ location.reload(); }, 800);
}

function batchMove(){
  var names = Array.from(selectedItems);
  sessionStorage.setItem('clip_name', JSON.stringify(names));
  sessionStorage.setItem('clip_action', 'move');
  sessionStorage.setItem('clip_src', currentPath);
  showToast('已剪切 '+names.length+' 项，请在目标位置粘贴', 'info');
  selectedItems.clear();
  refreshSelection();
  renderClipboard();
}

function batchCopy(){
  var names = Array.from(selectedItems);
  sessionStorage.setItem('clip_name', JSON.stringify(names));
  sessionStorage.setItem('clip_action', 'copy');
  sessionStorage.setItem('clip_src', currentPath);
  showToast('已复制 '+names.length+' 项，请在目标位置粘贴', 'info');
  selectedItems.clear();
  refreshSelection();
  renderClipboard();
}

// Upload
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');

['dragenter','dragover'].forEach(e=>{uploadArea.addEventListener(e,ev=>{ev.preventDefault();uploadArea.classList.add('dragover')})});
['dragleave','drop'].forEach(e=>{uploadArea.addEventListener(e,ev=>{ev.preventDefault();uploadArea.classList.remove('dragover')})});
uploadArea.addEventListener('drop',e=>{e.preventDefault();handleFiles(e.dataTransfer.files)});
fileInput.addEventListener('change',e=>{handleFiles(e.target.files)});

function formatSize(bytes){
  if(bytes===0) return '0 B';
  const k=1024,sizes=['B','KB','MB','GB','TB'];
  const i=Math.min(Math.floor(Math.log(bytes)/Math.log(k)), sizes.length - 1);
  return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+' '+sizes[i];
}

function uploadFile(file, onProgress){
  return new Promise(function(resolve, reject){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', currentPath + '?action=upload');
    xhr.upload.onprogress = function(e){
      if(e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
    };
    xhr.onload = function(){
      if(xhr.status >= 200 && xhr.status < 300) resolve(xhr.status);
      else reject(new Error(xhr.responseText || '上传失败'));
    };
    xhr.onerror = function(){ reject(new Error('网络错误')); };
    var fd = new FormData();
    fd.append('file', file);
    xhr.send(fd);
  });
}

async function handleFiles(files){
  if(!files.length) return;
  var progress = document.getElementById('uploadProgress');
  var bar = document.getElementById('progressBar');
  var text = document.getElementById('progressText');
  progress.style.display = 'block';
  var totalSize = 0;
  for(var i=0;i<files.length;i++) totalSize += files[i].size;
  var uploadedSize = 0;
  for(var i=0;i<files.length;i++){
    var file = files[i];
    var idx = i+1;
    text.textContent = '上传 ' + idx + '/' + files.length + '  ' + file.name;
    bar.style.width = (totalSize ? Math.round(uploadedSize/totalSize*100) : Math.round(i/files.length*100))+'%';
    try{
      await uploadFile(file, function(loaded, total){
        var pct = totalSize ? Math.round((uploadedSize + loaded) / totalSize * 100) : Math.round(idx/files.length*100);
        bar.style.width = pct + '%';
        text.textContent = '上传 ' + idx + '/' + files.length + '  ' + file.name + '  ' + formatSize(loaded) + '/' + formatSize(total);
      });
      uploadedSize += file.size;
      if(!totalSize) bar.style.width = Math.round(idx/files.length*100)+'%';
    }catch(e){
      text.textContent = '上传失败: ' + file.name + (e.message ? ' (' + e.message + ')' : '');
      return;
    }
  }
  bar.style.width = '100%';
  text.textContent = '上传完成！共 ' + files.length + ' 个文件';
  setTimeout(function(){ location.reload(); }, 800);
}

async function createFolder(){
  const name = document.getElementById('folderName').value.trim();
  if(!name) return alert('请输入文件夹名称');
  try{
    const r = await fetch(currentPath + '?action=mkdir&name=' + encodeURIComponent(name), {method:'POST'});
    if(r.ok) location.reload();
    else alert('创建失败');
  }catch(e){alert('创建失败')}
}

async function deleteItem(name){
  if(!confirm('确定删除 "'+name+'" 吗？此操作不可恢复。')) return;
  try{
    const r = await fetch(currentPath + '?action=delete&name=' + encodeURIComponent(name), {method:'POST'});
    if(r.ok) location.reload();
    else {const t=await r.text();alert('删除失败: '+t)}
  }catch(e){alert('删除失败')}
}

async function previewFile(name){
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
  const url = currentPath + encodeURIComponent(name);
  const overlay = document.getElementById('previewOverlay');
  const content = document.getElementById('previewContent');
  const nameEl = document.getElementById('previewName');
  nameEl.textContent = name;
  content.innerHTML = '';

  if(['jpg','jpeg','png','gif','webp','svg','bmp','ico'].includes(ext)){
    content.innerHTML = '<img src="'+url+'" alt="'+esc(name)+'">';
  } else if(['mp4','webm'].includes(ext)){
    content.innerHTML = '<video src="'+url+'" controls autoplay style="max-width:90%;max-height:80vh"></video>';
  } else if(['mp3','wav','ogg','aac','flac'].includes(ext)){
    content.innerHTML = '<audio src="'+url+'" controls autoplay></audio>';
  } else {
    try{
      const r = await fetch(url);
      const text = await r.text();
      content.innerHTML = '<pre>'+text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</pre>';
    }catch(e){
      content.innerHTML = '<p style="color:#fff">无法预览此文件</p>';
    }
  }
  overlay.classList.add('show');
}

// Rename
let renameTarget = '';
function showRename(name){
  renameTarget = name;
  document.getElementById('renameOldName').textContent = '原名称: ' + name;
  const input = document.getElementById('renameNewName');
  input.value = name;
  document.getElementById('renameModal').classList.add('show');
  setTimeout(()=>{input.focus();input.select()},100);
}
async function doRename(){
  const newName = document.getElementById('renameNewName').value.trim();
  if(!newName) return alert('请输入新名称');
  if(newName === renameTarget){closeModal('renameModal');return}
  try{
    const r = await fetch(currentPath + '?action=rename&name=' + encodeURIComponent(renameTarget) + '&newname=' + encodeURIComponent(newName), {method:'POST'});
    if(r.ok) location.reload();
    else {const t=await r.text();alert('重命名失败: '+t)}
  }catch(e){alert('重命名失败')}
}

// Toast notification
function showToast(msg, type){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'app-toast ' + (type||'info') + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.classList.remove('show'); }, 2500);
}

// Clipboard-based move/copy
function setClipboard(name, action){
  sessionStorage.setItem('clip_name', name);
  sessionStorage.setItem('clip_action', action);
  sessionStorage.setItem('clip_src', currentPath + encodeURIComponent(name));
  const label = action === 'move' ? '已剪切' : '已复制';
  showToast(label + ' ' + name + '，请在目标位置粘贴', 'info');
  renderClipboard();
}
function clearClipboard(){
  sessionStorage.removeItem('clip_name');
  sessionStorage.removeItem('clip_action');
  sessionStorage.removeItem('clip_src');
  renderClipboard();
}
function renderClipboard(){
  var name = sessionStorage.getItem('clip_name');
  var action = sessionStorage.getItem('clip_action');
  var bar = document.getElementById('clipboardBar');
  var toolbar = document.getElementById('toolbarPaste');
  if(!name || !action){
    if(bar) bar.innerHTML = '';
    if(toolbar) toolbar.innerHTML = '';
    return;
  }
  var isMove = action === 'move';
  var label = isMove ? '剪切' : '复制';
  var icon = isMove ? iconHtml('scissors','✂') : iconHtml('copy','⧉');
  var cls = isMove ? 'move' : 'copy';
  // Check if batch (JSON array) or single
  var isBatch = name.startsWith('[');
  var display;
  if(isBatch){
    var arr;
    try{ arr = JSON.parse(name); }
    catch(e){ clearClipboard(); return; }
    if(!Array.isArray(arr)){ clearClipboard(); return; }
    display = icon+' 已'+label+' <b>'+arr.length+'</b> 项';
  } else {
    display = icon+' 已'+label+' <b>'+esc(name)+'</b>';
  }
  // Clipboard bar
  bar.innerHTML = '<div class="clipboard-bar '+cls+'">'+
    '<span>'+display+'</span>'+
    '<span class="hide-mobile" style="opacity:0.7;font-size:13px">→ 浏览到目标文件夹后点击右侧按钮粘贴</span>'+
    '</div>';
  // Cancel button
  var cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-sm act-btn';
  cancelBtn.setAttribute('data-act', 'cancel-clip');
  cancelBtn.style.cssText = 'margin-left:auto;opacity:0.7';
  cancelBtn.innerHTML = iconHtml('x','×') + ' 取消';
  bar.querySelector('.clipboard-bar').appendChild(cancelBtn);
  // Paste button in toolbar
  toolbar.innerHTML = '';
  var pasteBtn = document.createElement('button');
  pasteBtn.className = 'btn btn-primary act-btn';
  pasteBtn.setAttribute('data-act', 'paste');
  pasteBtn.innerHTML = iconHtml('clipboard-paste','▣') + ' 粘贴到此处';
  toolbar.appendChild(pasteBtn);
  renderIcons();
}
function getClipDir(){
  var src = sessionStorage.getItem('clip_src') || '';
  // For single item: "/dir/file.txt" -> "/dir/"
  // For batch: already a directory like "/" or "/dir/"
  var name = sessionStorage.getItem('clip_name') || '';
  if(!name.startsWith('[')){
    var idx = src.lastIndexOf('/');
    src = src.substring(0, idx+1);
  }
  return src;
}

async function doPaste(){
  const name = sessionStorage.getItem('clip_name');
  const action = sessionStorage.getItem('clip_action');
  const srcBase = sessionStorage.getItem('clip_src');
  if(!name || !action) return;
  const label = action === 'move' ? '移动' : '复制';
  // Check if source dir == current dir
  const srcDir = getClipDir();
  const sameDir = srcDir === currentPath;
  if(sameDir && action === 'move'){
    clearClipboard();
    showToast('已在当前目录，无需移动', 'info');
    return;
  }
  // Check if batch
  if(name.startsWith('[')){
    let names;
    try{ names = JSON.parse(name); }
    catch(e){ clearClipboard(); showToast('剪贴板数据无效', 'info'); return; }
    if(!Array.isArray(names)){ clearClipboard(); showToast('剪贴板数据无效', 'info'); return; }
    var ok=0, skip=0, fail=0;
    for(var i=0;i<names.length;i++){
      const n = names[i];
      if(sameDir && action === 'move'){ skip++; continue; }
      const src = srcBase + encodeURIComponent(n);
      try{
        const r = await fetch(currentPath + '?action=' + action + '&name=' + encodeURIComponent(n) + '&dest=' + encodeURIComponent(currentPath) + '&src=' + encodeURIComponent(src), {method:'POST'});
        if(r.ok) ok++; else { const t=await r.text(); fail++; }
      }catch(e){ fail++; }
    }
    clearClipboard();
    var msg = label+'完成：成功 '+ok;
    if(skip) msg += '，跳过 '+skip;
    if(fail) msg += '，失败 '+fail;
    showToast(msg, fail > 0 ? 'info' : 'success');
    setTimeout(function(){ location.reload(); }, 800);
  } else {
    if(sameDir){ clearClipboard(); showToast('已在当前目录，无需'+label, 'info'); return; }
    try{
      const r = await fetch(currentPath + '?action=' + action + '&name=' + encodeURIComponent(name) + '&dest=' + encodeURIComponent(currentPath) + '&src=' + encodeURIComponent(srcBase), {method:'POST'});
      if(r.ok){ clearClipboard(); showToast('粘贴成功！', 'success'); setTimeout(function(){ location.reload(); }, 600); }
      else {const t=await r.text();showToast(label+'失败: '+t, 'info');}
    }catch(e){showToast(label+'失败', 'info')}
  }
}
// Initialize clipboard bar on page load
window.addEventListener('load', function(){
  renderIcons();
  try{ renderClipboard(); }catch(e){ console.error('renderClipboard error:', e); }
});
// Also try immediately
try{ renderIcons(); renderClipboard(); }catch(e){}
</script>
</body>
</html>`;
}

function copyRecursiveSync(src, dest){
  const st = fs.lstatSync(src);
  if(st.isSymbolicLink()){
    throw new Error('不支持复制符号链接');
  }
  if(st.isDirectory()){
    if(isInside(path.resolve(src), path.resolve(dest))){
      throw new Error('不能将目录复制到自身或子目录');
    }
    fs.mkdirSync(dest, {recursive:true});
    for(const entry of fs.readdirSync(src)){
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
  } else if(st.isFile()) {
    fs.copyFileSync(src, dest);
  } else {
    throw new Error('不支持复制该类型文件');
  }
}

function handle(req, res){
  const url = new URL(req.url, 'http://localhost');
  let rp = safeDecodeURIComponent(url.pathname);
  if(rp === null){ res.writeHead(400); res.end('Invalid path'); return; }
  if(!rp.startsWith('/')) rp = '/' + rp;

  const fp = safePath(rp);
  if(!fp){ res.writeHead(403); res.end('Forbidden'); return; }

  // POST actions
  if(req.method === 'POST'){
    const action = url.searchParams.get('action');
    if(!ensureSafeDirectory(fp)){
      res.writeHead(400);
      res.end('Invalid directory');
      return;
    }

    if(action === 'upload'){
      const contentType = req.headers['content-type'] || '';
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
      const boundary = boundaryMatch && (boundaryMatch[1] || boundaryMatch[2]);
      if(!boundary){ res.writeHead(400); res.end('Bad request'); return; }

      let body = [];
      req.on('data', chunk => body.push(chunk));
      req.on('end', () => {
        try{
          const buf = Buffer.concat(body);
          const boundaryBuf = Buffer.from('--' + boundary);
          const delimiter = Buffer.from('\r\n--' + boundary);
          let pos = buf.indexOf(boundaryBuf);
          if(pos < 0){ res.writeHead(200); res.end('OK'); return; }
          pos += boundaryBuf.length;
          while(pos < buf.length){
            if(buf[pos] === 0x2d && buf[pos+1] === 0x2d) break; // final --
            const headerStart = pos + 2; // skip \r\n
            const headerEnd = buf.indexOf(Buffer.from('\r\n\r\n'), headerStart);
            if(headerEnd < 0) break;
            const header = buf.slice(headerStart, headerEnd).toString('utf8');
            const filenameMatch = header.match(/filename="([^"]+)"/);
            if(filenameMatch){
              const filename = safeUploadedFilename(filenameMatch[1]);
              if(!filename){
                res.writeHead(400);
                res.end('Invalid filename');
                return;
              }
              const contentStart = headerEnd + 4;
              const nextBoundary = buf.indexOf(delimiter, contentStart);
              if(nextBoundary < 0) break;
              const destPath = safeChildPath(fp, filename);
              if(!destPath){ res.writeHead(400); res.end('Invalid filename'); return; }
              fs.writeFileSync(destPath, buf.slice(contentStart, nextBoundary));
              pos = nextBoundary + delimiter.length;
            } else {
              const nextBoundary = buf.indexOf(delimiter, headerEnd + 4);
              if(nextBoundary < 0) break;
              pos = nextBoundary + delimiter.length;
            }
          }
          res.writeHead(200, {'Content-Type':'text/plain'});
          res.end('OK');
        }catch(e){
          res.writeHead(500);
          res.end('Upload error: ' + e.message);
        }
      });
      return;
    }

    if(action === 'mkdir'){
      const name = safeName(url.searchParams.get('name'));
      if(!name){ res.writeHead(400); res.end('Missing name'); return; }
      const newDir = safeChildPath(fp, name);
      if(!newDir){ res.writeHead(400); res.end('Invalid name'); return; }
      try{
        fs.mkdirSync(newDir, {recursive:true});
        res.writeHead(200); res.end('OK');
      }catch(e){
        res.writeHead(500); res.end(e.message);
      }
      return;
    }

    if(action === 'delete'){
      const name = safeName(url.searchParams.get('name'));
      if(!name){ res.writeHead(400); res.end('Missing name'); return; }
      const target = safeChildPath(fp, name);
      if(!target){ res.writeHead(400); res.end('Invalid path'); return; }
      try{
        const st = fs.lstatSync(target);
        if(st.isSymbolicLink()){
          fs.unlinkSync(target);
        } else if(st.isDirectory()){
          if(!realPathInsideRoot(target)){ res.writeHead(403); res.end('Forbidden'); return; }
          fs.rmSync(target, {recursive:true, force:true});
        } else {
          if(!realPathInsideRoot(target)){ res.writeHead(403); res.end('Forbidden'); return; }
          fs.unlinkSync(target);
        }
        res.writeHead(200); res.end('OK');
      }catch(e){
        res.writeHead(500); res.end(e.message);
      }
      return;
    }

    if(action === 'rename'){
      const name = safeName(url.searchParams.get('name'));
      const newName = safeName(url.searchParams.get('newname'));
      if(!name || !newName){ res.writeHead(400); res.end('Missing parameters'); return; }
      const src = safeChildPath(fp, name);
      const dest = safeChildPath(fp, newName);
      if(!src || !dest){ res.writeHead(400); res.end('Invalid path'); return; }
      if(pathExists(dest)){ res.writeHead(409); res.end('目标已存在同名文件或文件夹'); return; }
      try{
        fs.renameSync(src, dest);
        res.writeHead(200); res.end('OK');
      }catch(e){
        res.writeHead(500); res.end(e.message);
      }
      return;
    }

    if(action === 'move'){
      const name = safeName(url.searchParams.get('name'));
      const destDir = url.searchParams.get('dest');
      const srcParam = url.searchParams.get('src');
      if(!name || !destDir){ res.writeHead(400); res.end('Missing parameters'); return; }
      const src = srcParam ? getSafePathParam(srcParam) : safeChildPath(fp, name);
      const destFolder = getSafePathParam(destDir);
      if(!src || !destFolder || !ensureSafeDirectory(path.dirname(src)) || !ensureSafeDirectory(destFolder)){ res.writeHead(400); res.end('Invalid path'); return; }
      const dest = safeChildPath(destFolder, name);
      if(!dest){ res.writeHead(400); res.end('Invalid path'); return; }
      if(src === dest){ res.writeHead(200); res.end('OK'); return; }
      if(pathExists(dest)){ res.writeHead(409); res.end('目标目录已存在同名文件或文件夹'); return; }
      try{
        const srcStat = fs.lstatSync(src);
        if(srcStat.isDirectory() && isInside(path.resolve(src), path.resolve(dest))){
          res.writeHead(400); res.end('不能将目录移动到自身或子目录'); return;
        }
        fs.renameSync(src, dest);
        res.writeHead(200); res.end('OK');
      }catch(e){
        res.writeHead(500); res.end(e.message);
      }
      return;
    }

    if(action === 'copy'){
      const name = safeName(url.searchParams.get('name'));
      const destDir = url.searchParams.get('dest');
      const srcParam = url.searchParams.get('src');
      if(!name || !destDir){ res.writeHead(400); res.end('Missing parameters'); return; }
      const src = srcParam ? getSafePathParam(srcParam) : safeChildPath(fp, name);
      const destFolder = getSafePathParam(destDir);
      if(!src || !destFolder || !ensureSafeDirectory(path.dirname(src)) || !ensureSafeDirectory(destFolder)){ res.writeHead(400); res.end('Invalid path'); return; }
      const dest = safeChildPath(destFolder, name);
      if(!dest){ res.writeHead(400); res.end('Invalid path'); return; }
      if(src === dest){ res.writeHead(200); res.end('OK'); return; }
      if(pathExists(dest)){ res.writeHead(409); res.end('目标目录已存在同名文件或文件夹'); return; }
      try{
        copyRecursiveSync(src, dest);
        res.writeHead(200); res.end('OK');
      }catch(e){
        res.writeHead(500); res.end(e.message);
      }
      return;
    }

    if(action === 'batchdownload'){
      let names = [];
      try{ names = JSON.parse(url.searchParams.get('names')||'[]'); }catch(e){}
      if(!Array.isArray(names)||names.length===0){ res.writeHead(400); res.end('Missing names'); return; }
      names = names.map(safeName);
      if(names.some(name => !name)){ res.writeHead(400); res.end('Invalid names'); return; }
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'winfm-zip-'));
      const zipPath = tmpDir + '.zip';
      function cleanupZipTemp(){
        try{ fs.unlinkSync(zipPath); }catch(e){}
        try{ fs.rmSync(tmpDir, {recursive:true,force:true}); }catch(e){}
      }
      try{
        for(const name of names){
          const src = safeChildPath(fp, name);
          if(!src || !pathExists(src)) continue;
          const srcStat = fs.lstatSync(src);
          if(!realPathInsideRoot(src)) continue;
          const dest = path.join(tmpDir, name);
          try{
            if(srcStat.isDirectory()) copyRecursiveSync(src, dest);
            else fs.copyFileSync(src, dest);
          }catch(e){}
        }
        const dirName = rp === '/' ? 'files' : path.basename(rp.replace(/[/]$/,''));
        const zipName = dirName + '.zip';
        const { spawn } = require('child_process');
        const zipProc = spawn('zip', ['-r', zipPath, '.'], {cwd: tmpDir, stdio:['ignore','pipe','pipe']});
        zipProc.on('close', function(code){
          try{
            if(code !== 0 || !pathExists(zipPath)){
              res.writeHead(500); res.end('Zip failed');
              cleanupZipTemp();
              return;
            }
            const zipStat = fs.statSync(zipPath);
            res.writeHead(200,{
              'Content-Type':'application/zip',
              'Content-Disposition':attachmentDisposition(zipName),
              'Content-Length':zipStat.size
            });
            const stream = fs.createReadStream(zipPath);
            stream.pipe(res);
            stream.on('close', function(){
              cleanupZipTemp();
            });
          }catch(e){
            cleanupZipTemp();
            try{ res.writeHead(500); res.end('Error: '+e.message); }catch(ex){}
          }
        });
        zipProc.on('error', function(e){
          cleanupZipTemp();
          try{ res.writeHead(500); res.end('Zip error: '+e.message); }catch(ex){}
        });
      }catch(e){
        cleanupZipTemp();
        res.writeHead(500); res.end('Zip error: '+e.message);
      }
      return;
    }

    if(action === 'listdirs'){
      const targetDir = url.searchParams.get('dir') || '/';
      const targetFp = getSafePathParam(targetDir);
      if(!targetFp || !ensureSafeDirectory(targetFp)){ res.writeHead(400); res.end('Invalid path'); return; }
      try{
        const entries = fs.readdirSync(targetFp, {withFileTypes:true})
          .filter(e => e.isDirectory())
          .map(e => e.name)
          .sort((a,b) => a.localeCompare(b));
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify(entries));
      }catch(e){
        res.writeHead(500); res.end(e.message);
      }
      return;
    }

    res.writeHead(400); res.end('Unknown action');
    return;
  }

  // GET
  if(!pathExists(fp)){
    res.writeHead(404);
    res.end('<h1>404 Not Found</h1>');
    return;
  }

  if(!realPathInsideRoot(fp)){
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const st = fs.statSync(fp);

  if(st.isDirectory()){
    if(!rp.endsWith('/')){ res.writeHead(301,{Location:rp+'/'}); res.end(); return; }

    let items = [];
    try{
      items = fs.readdirSync(fp, {withFileTypes:true}).map(e=>{
        const itemPath = path.join(fp, e.name);
        let size=0, mtime=null;
        try{ const s=fs.lstatSync(itemPath); size=s.size; mtime=s.mtime; }catch(ex){}
        return {name:e.name, isDir:e.isDirectory(), size, mtime};
      });
    }catch(e){}

    let sortField = url.searchParams.get('sort') || 'name';
    if(!['name','size','mtime'].includes(sortField)) sortField = 'name';
    const sortDir = url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
    const groupDirs = url.searchParams.get('group') !== '0';

    items.sort((a,b)=>{
      if(groupDirs && a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      if(sortField === 'size') cmp = a.size - b.size;
      else if(sortField === 'mtime') cmp = (a.mtime ? new Date(a.mtime).getTime() : 0) - (b.mtime ? new Date(b.mtime).getTime() : 0);
      else cmp = a.name.localeCompare(b.name);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    const msgParam = url.searchParams.get('msg');
    let msg = null;
    if(msgParam === 'uploaded') msg = {type:'success',text:'文件上传成功'};
    else if(msgParam === 'deleted') msg = {type:'success',text:'删除成功'};

    res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});
    res.end(getHTML(items, rp, msg, sortField, sortDir, groupDirs));
    return;
  }

  // Serve file
  const ext = path.extname(fp).toLowerCase();
  const download = url.searchParams.get('download');

  if(download){
    const dlName = path.basename(fp);
    res.writeHead(200,{
      'Content-Type':'application/octet-stream',
      'Content-Disposition':attachmentDisposition(dlName),
      'Content-Length':st.size
    });
    fs.createReadStream(fp).pipe(res);
    return;
  }

  res.writeHead(200,{
    'Content-Type':MIME[ext]||'application/octet-stream',
    'Content-Length':st.size
  });
  fs.createReadStream(fp).pipe(res);
}

process.on('uncaughtException',(e)=>{console.error('uncaughtException:',e.message);});
process.on('unhandledRejection',(e)=>{console.error('unhandledRejection:',e);});

const server = http.createServer((req,res)=>{
  try{ handle(req,res); }catch(e){ console.error('Error:',e.message); try{res.writeHead(500);res.end('Internal error: '+e.message)}catch(err){} }
});
server.on('error',(e)=>{console.error('server.error:',e.message);});
server.listen(PORT,'0.0.0.0',()=>console.log('📂 文件管理已启动 端口:'+PORT+' 目录:'+ROOT));
