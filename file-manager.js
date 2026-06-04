const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 8888;
const ROOT = '/data';
try { fs.mkdirSync(ROOT, { recursive: true }); } catch(e) {}

const MIME = {'.html':'text/html;charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.pdf':'application/pdf','.zip':'application/zip','.txt':'text/plain;charset=utf-8','.md':'text/plain;charset=utf-8','.mp4':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.ico':'image/x-icon','.webp':'image/webp','.doc':'application/msword','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xls':'application/vnd.ms-excel','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.ppt':'application/vnd.ms-powerpoint','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.csv':'text/csv','.xml':'text/xml','.yaml':'text/plain','.yml':'text/plain','.log':'text/plain','.sh':'text/plain','.py':'text/plain','.java':'text/plain','.c':'text/plain','.cpp':'text/plain','.h':'text/plain','.go':'text/plain','.rs':'text/plain','.ts':'text/plain','.tsx':'text/plain','.jsx':'text/plain','.vue':'text/plain'};

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

function safePath(rp){
  const fp = path.join(ROOT, rp).replace(/\\/g, '/');
  if(!fp.startsWith(ROOT)) return null;
  return fp;
}

function formatSize(bytes){
  if(bytes===0) return '0 B';
  const k=1024,sizes=['B','KB','MB','GB','TB'];
  const i=Math.floor(Math.log(bytes)/Math.log(k));
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
  let cumPath = '/';
  for(const b of breadcrumbs){
    cumPath += b + '/';
    breadcrumbHtml += '<span class="breadcrumb-sep">/</span><a href="'+encodeURI(cumPath)+'" class="breadcrumb-item">'+esc(decodeURIComponent(b))+'</a>';
  }

  const msgHtml = msg ? '<div class="msg '+msg.type+'">'+esc(msg.text)+'</div>' : '';

  const listHtml = list.map(i=>{
    const href = i.isDir ? encodeURI(i.name+'/') : encodeURI(i.name);
    const icon = getIcon(i.name, i.isDir);
    const size = i.isDir ? '-' : formatSize(i.size);
    const mtime = i.mtime ? new Date(i.mtime).toLocaleString('zh-CN') : '-';
    const dlBtn = i.isDir ? '' : '<a href="'+encodeURI(i.name)+'?download=1" class="btn btn-sm" title="下载">⬇️</a>';
    const previewBtn = i.isDir ? '' : '<a href="'+encodeURI(i.name)+'" class="btn btn-sm" title="预览" target="_blank">👁️</a>';
    const dn = esc(i.name);
    return '<tr class="file-row" data-name="'+dn+'">'+
      '<td class="col-check"><input type="checkbox" class="row-cb" data-name="'+dn+'"></td>'+
      '<td class="col-icon file-icon">'+icon+'</td>'+
      '<td class="col-name file-name"><a href="'+href+'">'+dn+'</a></td>'+
      '<td class="col-size file-size">'+size+'</td>'+
      '<td class="col-time file-time">'+mtime+'</td>'+
      '<td class="col-actions file-actions">'+previewBtn+dlBtn+
        '<button class="btn btn-sm act-btn" data-act="rename" data-name="'+dn+'" title="重命名">✏️</button>'+
        '<button class="btn btn-sm act-btn" data-act="move" data-name="'+dn+'" title="移动">📦</button>'+
        '<button class="btn btn-sm act-btn" data-act="copy" data-name="'+dn+'" title="复制">📋</button>'+
        '<button class="btn btn-sm btn-danger act-btn" data-act="delete" data-name="'+dn+'">🗑️</button></td>'+
      '</tr>';
  }).join('');

  const emptyHtml = list.length === 0 ? '<div class="empty">📂 空目录，上传文件或新建文件夹开始使用</div>' : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>文件管理</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f2f5;color:#333;min-height:100vh}
.header{background:#fff;border-bottom:1px solid #e8e8e8;padding:16px 24px;display:flex;align-items:center;gap:16px;position:sticky;top:0;z-index:100;box-shadow:0 1px 4px rgba(0,0,0,0.05)}
.header h1{font-size:20px;font-weight:600;color:#1a1a1a;white-space:nowrap}
.header h1 span{margin-right:6px}
.breadcrumb{display:flex;align-items:center;flex-wrap:wrap;gap:4px;flex:1;min-width:0}
.breadcrumb-item{color:#6366f1;text-decoration:none;font-size:14px;padding:4px 8px;border-radius:6px;transition:background 0.2s}
.breadcrumb-item:hover{background:#f0f0ff}
.breadcrumb-sep{color:#ccc;font-size:12px}
.container{max-width:1200px;margin:0 auto;padding:20px}
.toolbar{display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border:1px solid #d9d9d9;border-radius:8px;background:#fff;color:#333;font-size:14px;cursor:pointer;transition:all 0.2s;text-decoration:none;white-space:nowrap}
.btn:hover{border-color:#6366f1;color:#6366f1;background:#f5f5ff}
.btn-primary{background:#6366f1;color:#fff;border-color:#6366f1}
.btn-primary:hover{background:#4f46e5;border-color:#4f46e5;color:#fff}
.btn-danger{border-color:#ff4d4f;color:#ff4d4f}
.btn-danger:hover{background:#fff1f0;border-color:#ff4d4f}
.btn-sm{padding:4px 10px;font-size:13px;border-radius:6px}
.msg{padding:10px 16px;border-radius:8px;margin-bottom:16px;font-size:14px}
.msg.success{background:#f6ffed;border:1px solid #b7eb8f;color:#52c41a}
.msg.error{background:#fff2f0;border:1px solid #ffccc7;color:#ff4d4f}
.table-wrap{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);overflow:hidden}
table{width:100%;border-collapse:collapse}
th{background:#fafafa;border-bottom:1px solid #e8e8e8;padding:12px 16px;text-align:left;font-weight:600;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.5px}
td{padding:10px 16px;border-bottom:1px solid #f0f0f0;font-size:14px}
tr:last-child td{border-bottom:none}
.file-row:hover{background:#f8f9ff}
.file-icon{font-size:18px;width:40px;text-align:center}
.file-name a{color:#333;text-decoration:none;word-break:break-all}
.file-name a:hover{color:#6366f1;text-decoration:underline}
.file-size,.file-time{color:#999;font-size:13px;white-space:nowrap}
.file-actions{display:flex;gap:6px;white-space:nowrap}
.empty{text-align:center;padding:60px 20px;color:#999;font-size:16px}
.modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:200;justify-content:center;align-items:center}
.modal-overlay.show{display:flex}
.modal{background:#fff;border-radius:12px;padding:24px;min-width:400px;max-width:500px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.15)}
.modal h2{font-size:18px;margin-bottom:16px;color:#1a1a1a}
.modal input[type=text]{width:100%;padding:10px 14px;border:1px solid #d9d9d9;border-radius:8px;font-size:14px;margin-bottom:16px;outline:none;transition:border 0.2s}
.modal input[type=text]:focus{border-color:#6366f1}
.modal-actions{display:flex;gap:10px;justify-content:flex-end}
.upload-area{border:2px dashed #d9d9d9;border-radius:12px;padding:40px;text-align:center;cursor:pointer;transition:all 0.2s;margin-bottom:16px}
.upload-area:hover,.upload-area.dragover{border-color:#6366f1;background:#f5f5ff}
.upload-area.dragover{transform:scale(1.01)}
.upload-area p{color:#999;margin-top:8px;font-size:14px}
.upload-area .icon{font-size:48px}
.drop-zone-hint{font-size:12px;color:#bbb;margin-top:4px}
.preview-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:300;justify-content:center;align-items:center;flex-direction:column}
.preview-overlay.show{display:flex}
.preview-overlay img,.preview-overlay video,.preview-overlay audio{max-width:90%;max-height:80vh;border-radius:8px}
.preview-overlay pre{background:#1a1a2e;color:#e0e0e0;padding:20px;border-radius:8px;max-width:90%;max-height:80vh;overflow:auto;font-size:14px;line-height:1.6;white-space:pre-wrap;word-break:break-all}
.preview-close{position:absolute;top:20px;right:30px;color:#fff;font-size:32px;cursor:pointer;background:none;border:none;z-index:301}
.preview-name{color:#fff;margin-top:12px;font-size:16px}
.fb-item{display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;transition:background 0.15s;border-bottom:1px solid #f5f5f5;font-size:14px}
.fb-item:last-child{border-bottom:none}
.fb-item:hover{background:#f0f0ff}
.fb-icon{font-size:16px;flex-shrink:0}
.clipboard-bar{display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:8px;margin-bottom:16px;font-size:14px;flex-wrap:wrap}
.clipboard-bar.move{background:#fef3e2;border:1px solid #f5c26a;color:#b86e00}
.clipboard-bar.copy{background:#eef0ff;border:1px solid #a5b4fc;color:#4f46e5}
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:8px;font-size:14px;z-index:999;opacity:0;transition:opacity 0.3s;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,0.15)}
.toast.show{opacity:1}
.toast.success{background:#52c41a;color:#fff}
.toast.info{background:#6366f1;color:#fff}
.col-check{width:36px;text-align:center}
.col-check input[type=checkbox]{width:16px;height:16px;cursor:pointer;accent-color:#6366f1}
.sortable{cursor:pointer;user-select:none;transition:background 0.15s;position:relative}
.sortable:hover{background:#f0f0ff}
.sortable a{color:#666;text-decoration:none;display:inline-flex;align-items:center;gap:4px}
.sortable a:hover{color:#6366f1}
.sortable .sort-icon{font-size:10px;color:#6366f1}
.sortable:not(.sort-active) .sort-icon{opacity:0.3}
.group-toggle{display:inline-flex;align-items:center;gap:4px;font-size:13px;color:#666;cursor:pointer;padding:4px 10px;border:1px solid #d9d9d9;border-radius:6px;background:#fff;transition:all 0.2s}
.group-toggle:hover{border-color:#6366f1;color:#6366f1}
.group-toggle.active{background:#6366f1;color:#fff;border-color:#6366f1}
tr.selected{background:#f0f0ff!important}
.batch-bar{display:flex;align-items:center;gap:10px;padding:10px 16px;background:#6366f1;color:#fff;border-radius:8px;margin-bottom:16px;font-size:14px;flex-wrap:wrap}
.batch-bar .btn{color:#fff;border-color:rgba(255,255,255,0.4);background:transparent}
.batch-bar .btn:hover{background:rgba(255,255,255,0.15);border-color:#fff}
.batch-bar .btn-danger{border-color:rgba(255,100,100,0.6)}
.batch-bar .btn-danger:hover{background:rgba(255,80,80,0.25)}
@media(max-width:768px){
  .header{flex-direction:column;align-items:flex-start;gap:8px;padding:10px 12px}
  .breadcrumb{font-size:12px}
  .breadcrumb-item{padding:3px 6px;font-size:12px}
  .container{padding:12px}
  .toolbar{gap:6px}
  .toolbar .btn{padding:6px 10px;font-size:12px}
  table{table-layout:fixed}
  th,td{padding:8px 6px;font-size:13px}
  .col-size,.col-time{display:none}
  .col-icon{width:32px}
  .col-name{overflow:hidden;text-overflow:ellipsis}
  .col-actions{width:auto}
  .col-check{width:28px}
  .col-check input[type=checkbox]{width:14px;height:14px}
  .file-name a{font-size:13px}
  .file-actions{gap:2px;flex-wrap:wrap}
  .file-actions .btn-sm{padding:4px 6px;font-size:12px;border-radius:6px}
  .file-actions .btn-sm span{display:none}
  .modal{min-width:auto!important;width:95%!important;padding:16px}
  .clipboard-bar{padding:8px 12px;font-size:13px;gap:8px}
  .clipboard-bar .hide-mobile{display:none}
  .toast{font-size:13px;padding:10px 18px;max-width:90%}
}
</style>
</head>
<body>
<div id="toast" class="toast"></div>
<div class="header">
  <h1><span>📂</span>文件管理</h1>
  <div class="breadcrumb">${breadcrumbHtml}</div>
</div>
<div class="container">
  ${msgHtml}
  <div class="toolbar">
    <button class="btn btn-primary" onclick="showUpload()">📤 上传文件</button>
    <button class="btn" onclick="showNewFolder()">📁 新建文件夹</button>
    <button class="btn" onclick="location.reload()">🔄 刷新</button>
    <a href="${rp}?sort=${sortField}&dir=${sortDir}&group=${groupDirs?0:1}" class="group-toggle${groupDirs?' active':''}" title="切换目录优先显示">📁 目录优先</a>
    <span id="toolbarPaste"></span>
  </div>
  <div id="batchBar"></div>
  <div id="clipboardBar"></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th class="col-check" style="width:36px"><input type="checkbox" id="selectAll"></th><th class="col-icon" style="width:40px"></th><th class="col-name sortable${sortClass('name')}"><a href="${sortUrl('name')}">名称${sortIcon('name')}</a></th><th class="col-size sortable${sortClass('size')}" style="width:80px"><a href="${sortUrl('size')}">大小${sortIcon('size')}</a></th><th class="col-time sortable${sortClass('mtime')}" style="width:160px"><a href="${sortUrl('mtime')}">修改时间${sortIcon('mtime')}</a></th><th class="col-actions" style="width:220px">操作</th></tr></thead>
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
  <div class="modal">
    <h2>📤 上传文件</h2>
    <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()">
      <div class="icon">📁</div>
      <p>点击选择文件，或拖拽文件到这里</p>
      <div class="drop-zone-hint">支持多文件上传</div>
    </div>
    <input type="file" id="fileInput" multiple style="display:none">
    <div id="uploadProgress" style="display:none">
      <div style="background:#f0f0f0;border-radius:8px;overflow:hidden;height:8px;margin-bottom:8px">
        <div id="progressBar" style="background:#6366f1;height:100%;width:0%;transition:width 0.3s"></div>
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
  <div class="modal">
    <h2>📁 新建文件夹</h2>
    <input type="text" id="folderName" placeholder="输入文件夹名称">
    <div class="modal-actions">
      <button class="btn" onclick="closeModal('folderModal')">取消</button>
      <button class="btn btn-primary" onclick="createFolder()">创建</button>
    </div>
  </div>
</div>

<!-- Rename Modal -->
<div class="modal-overlay" id="renameModal">
  <div class="modal">
    <h2>✏️ 重命名</h2>
    <div id="renameOldName" style="font-size:13px;color:#999;margin-bottom:12px;word-break:break-all"></div>
    <input type="text" id="renameNewName" placeholder="输入新名称">
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
  else if(act === 'move') setClipboard(name, 'move');
  else if(act === 'copy') setClipboard(name, 'copy');
  else if(act === 'delete') deleteItem(name);
  else if(act === 'paste') doPaste();
  else if(act === 'cancel-clip') clearClipboard();
  else if(act === 'batch-delete') batchDelete();
  else if(act === 'batch-move') batchMove();
  else if(act === 'batch-copy') batchCopy();
  else if(act === 'batch-download') batchDownload();
});

// Multi-select & batch operations
var selectedItems = new Set();

function updateBatchBar(){
  var bar = document.getElementById('batchBar');
  if(!bar) return;
  if(selectedItems.size === 0){ bar.innerHTML = ''; return; }
  var n = selectedItems.size;
  bar.innerHTML = '<div class="batch-bar">'+
    '<span>已选 <b>'+n+'</b> 项</span>'+
    '<button class="btn btn-sm act-btn" data-act="batch-download">📦 打包下载</button>'+
    '<button class="btn btn-sm act-btn" data-act="batch-copy">📋 批量复制</button>'+
    '<button class="btn btn-sm act-btn" data-act="batch-move">✂️ 批量移动</button>'+
    '<button class="btn btn-sm btn-danger act-btn" data-act="batch-delete">🗑️ 批量删除</button>'+
    '<button class="btn btn-sm act-btn" data-act="batch-clear" style="margin-left:auto">✕ 取消选择</button>'+
    '</div>';
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

// Batch clear (event delegation)
document.addEventListener('click', function(e){
  var btn = e.target.closest('.act-btn');
  if(!btn) return;
  if(btn.dataset.act === 'batch-clear'){
    selectedItems.clear();
    refreshSelection();
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
  const k=1024,sizes=['B','KB','MB','GB'];
  const i=Math.floor(Math.log(bytes)/Math.log(k));
  return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+' '+sizes[i];
}

function uploadFile(file, onProgress){
  return new Promise(function(resolve, reject){
    var xhr = new XMLHttpRequest();
    xhr.open('POST', currentPath + '?action=upload');
    xhr.upload.onprogress = function(e){
      if(e.lengthComputable && onProgress) onProgress(e.loaded, e.total);
    };
    xhr.onload = function(){ resolve(xhr.status); };
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
    bar.style.width = Math.round(uploadedSize/totalSize*100)+'%';
    try{
      await uploadFile(file, function(loaded, total){
        var pct = Math.round((uploadedSize + loaded) / totalSize * 100);
        bar.style.width = pct + '%';
        text.textContent = '上传 ' + idx + '/' + files.length + '  ' + file.name + '  ' + formatSize(loaded) + '/' + formatSize(total);
      });
      uploadedSize += file.size;
    }catch(e){
      text.textContent = '上传失败: ' + file.name;
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
  const ext = name.split('.').pop().toLowerCase();
  const url = encodeURI(currentPath + name);
  const overlay = document.getElementById('previewOverlay');
  const content = document.getElementById('previewContent');
  const nameEl = document.getElementById('previewName');
  nameEl.textContent = name;
  content.innerHTML = '';

  if(['jpg','jpeg','png','gif','webp','svg','bmp','ico'].includes(ext)){
    content.innerHTML = '<img src="'+url+'" alt="'+name+'">';
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
  t.className = 'toast ' + (type||'info') + ' show';
  clearTimeout(t._timer);
  t._timer = setTimeout(()=>{ t.classList.remove('show'); }, 2500);
}

// Clipboard-based move/copy
function setClipboard(name, action){
  sessionStorage.setItem('clip_name', name);
  sessionStorage.setItem('clip_action', action);
  sessionStorage.setItem('clip_src', currentPath + encodeURIComponent(name));
  console.log('Clipboard set:', name, action, 'src:', currentPath + encodeURIComponent(name));
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
  console.log('renderClipboard:', name, action);
  var bar = document.getElementById('clipboardBar');
  var toolbar = document.getElementById('toolbarPaste');
  if(!name || !action){
    if(bar) bar.innerHTML = '';
    if(toolbar) toolbar.innerHTML = '';
    return;
  }
  var isMove = action === 'move';
  var label = isMove ? '剪切' : '复制';
  var icon = isMove ? '✂️' : '📋';
  var cls = isMove ? 'move' : 'copy';
  // Check if batch (JSON array) or single
  var isBatch = name.startsWith('[');
  var display;
  if(isBatch){
    var arr = JSON.parse(name);
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
  cancelBtn.textContent = '✕ 取消';
  bar.querySelector('.clipboard-bar').appendChild(cancelBtn);
  // Paste button in toolbar
  toolbar.innerHTML = '';
  var pasteBtn = document.createElement('button');
  pasteBtn.className = 'btn btn-primary act-btn';
  pasteBtn.setAttribute('data-act', 'paste');
  pasteBtn.textContent = '📌 粘贴到此处';
  toolbar.appendChild(pasteBtn);
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
    const names = JSON.parse(name);
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
  try{ renderClipboard(); }catch(e){ console.error('renderClipboard error:', e); }
});
// Also try immediately
try{ renderClipboard(); }catch(e){}
</script>
</body>
</html>`;
}

function copyRecursiveSync(src, dest){
  const st = fs.statSync(src);
  if(st.isDirectory()){
    fs.mkdirSync(dest, {recursive:true});
    for(const entry of fs.readdirSync(src)){
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function handle(req, res){
  const url = new URL(req.url, 'http://localhost');
  let rp = decodeURIComponent(url.pathname);
  if(!rp.startsWith('/')) rp = '/' + rp;

  const fp = safePath(rp);
  if(!fp){ res.writeHead(403); res.end('Forbidden'); return; }

  // POST actions
  if(req.method === 'POST'){
    const action = url.searchParams.get('action');

    if(action === 'upload'){
      const contentType = req.headers['content-type'] || '';
      const boundary = contentType.split('boundary=')[1];
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
              const filename = filenameMatch[1];
              const contentStart = headerEnd + 4;
              const nextBoundary = buf.indexOf(delimiter, contentStart);
              if(nextBoundary < 0) break;
              const destPath = path.join(fp, filename);
              if(destPath.startsWith(ROOT)){
                fs.writeFileSync(destPath, buf.slice(contentStart, nextBoundary));
              }
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
      const name = url.searchParams.get('name');
      if(!name){ res.writeHead(400); res.end('Missing name'); return; }
      const newDir = path.join(fp, name);
      if(!newDir.startsWith(ROOT)){ res.writeHead(403); res.end('Forbidden'); return; }
      try{
        fs.mkdirSync(newDir, {recursive:true});
        res.writeHead(200); res.end('OK');
      }catch(e){
        res.writeHead(500); res.end(e.message);
      }
      return;
    }

    if(action === 'delete'){
      const name = url.searchParams.get('name');
      if(!name){ res.writeHead(400); res.end('Missing name'); return; }
      const target = path.join(fp, name);
      if(!target.startsWith(ROOT)){ res.writeHead(400); res.end('Invalid path'); return; }
      try{
        const st = fs.statSync(target);
        if(st.isDirectory()){
          fs.rmSync(target, {recursive:true, force:true});
        } else {
          fs.unlinkSync(target);
        }
        res.writeHead(200); res.end('OK');
      }catch(e){
        res.writeHead(500); res.end(e.message);
      }
      return;
    }

    if(action === 'rename'){
      const name = url.searchParams.get('name');
      const newName = url.searchParams.get('newname');
      if(!name || !newName){ res.writeHead(400); res.end('Missing parameters'); return; }
      const src = path.join(fp, name);
      const dest = path.join(fp, newName);
      if(!src.startsWith(ROOT) || !dest.startsWith(ROOT)){ res.writeHead(400); res.end('Invalid path'); return; }
      if(fs.existsSync(dest)){ res.writeHead(409); res.end('目标已存在同名文件或文件夹'); return; }
      try{
        fs.renameSync(src, dest);
        res.writeHead(200); res.end('OK');
      }catch(e){
        res.writeHead(500); res.end(e.message);
      }
      return;
    }

    if(action === 'move'){
      const name = url.searchParams.get('name');
      const destDir = url.searchParams.get('dest');
      const srcParam = url.searchParams.get('src');
      if(!name || !destDir){ res.writeHead(400); res.end('Missing parameters'); return; }
      const src = srcParam ? safePath(decodeURIComponent(srcParam)) : path.join(fp, name);
      const destFolder = safePath(decodeURIComponent(destDir));
      if(!src || !src.startsWith(ROOT) || !destFolder){ res.writeHead(400); res.end('Invalid path'); return; }
      const dest = path.join(destFolder, name);
      if(!dest.startsWith(ROOT)){ res.writeHead(400); res.end('Invalid path'); return; }
      if(src === dest){ res.writeHead(200); res.end('OK'); return; }
      if(fs.existsSync(dest)){ res.writeHead(409); res.end('目标目录已存在同名文件或文件夹'); return; }
      try{
        fs.mkdirSync(destFolder, {recursive:true});
        fs.renameSync(src, dest);
        res.writeHead(200); res.end('OK');
      }catch(e){
        res.writeHead(500); res.end(e.message);
      }
      return;
    }

    if(action === 'copy'){
      const name = url.searchParams.get('name');
      const destDir = url.searchParams.get('dest');
      const srcParam = url.searchParams.get('src');
      if(!name || !destDir){ res.writeHead(400); res.end('Missing parameters'); return; }
      const src = srcParam ? safePath(decodeURIComponent(srcParam)) : path.join(fp, name);
      const destFolder = safePath(decodeURIComponent(destDir));
      if(!src || !src.startsWith(ROOT) || !destFolder){ res.writeHead(400); res.end('Invalid path'); return; }
      const dest = path.join(destFolder, name);
      if(!dest.startsWith(ROOT)){ res.writeHead(400); res.end('Invalid path'); return; }
      if(src === dest){ res.writeHead(200); res.end('OK'); return; }
      if(fs.existsSync(dest)){ res.writeHead(409); res.end('目标目录已存在同名文件或文件夹'); return; }
      try{
        fs.mkdirSync(destFolder, {recursive:true});
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
      const tmpDir = path.join(ROOT, '.tmp_zip_' + Date.now() + '_' + Math.random().toString(36).slice(2));
      try{
        fs.mkdirSync(tmpDir, {recursive:true});
        for(const name of names){
          const src = path.join(fp, name);
          if(!src.startsWith(ROOT)) continue;
          const dest = path.join(tmpDir, name);
          try{
            const st = fs.statSync(src);
            if(st.isDirectory()) copyRecursiveSync(src, dest);
            else fs.copyFileSync(src, dest);
          }catch(e){}
        }
        const dirName = rp === '/' ? 'files' : path.basename(rp.replace(/[/]$/,''));
        const zipName = dirName + '.zip';
        const zipPath = tmpDir + '.zip';
        const asciiName = zipName.replace(/[^\x20-\x7e]/g, '_');
        const encodedName = encodeURIComponent(zipName);
        const { spawn } = require('child_process');
        const zipProc = spawn('zip', ['-r', zipPath, '.'], {cwd: tmpDir, stdio:['ignore','pipe','pipe']});
        zipProc.on('close', function(code){
          try{
            if(code !== 0 || !fs.existsSync(zipPath)){
              res.writeHead(500); res.end('Zip failed');
              try{ fs.rmSync(tmpDir, {recursive:true,force:true}); }catch(e){}
              return;
            }
            const zipStat = fs.statSync(zipPath);
            res.writeHead(200,{
              'Content-Type':'application/zip',
              'Content-Disposition':"attachment; filename=\""+asciiName+"\"; filename*=UTF-8''"+encodedName,
              'Content-Length':zipStat.size
            });
            const stream = fs.createReadStream(zipPath);
            stream.pipe(res);
            stream.on('close', function(){
              try{ fs.unlinkSync(zipPath); }catch(e){}
              try{ fs.rmSync(tmpDir, {recursive:true,force:true}); }catch(e){}
            });
          }catch(e){
            try{ fs.rmSync(tmpDir, {recursive:true,force:true}); }catch(ex){}
            try{ res.writeHead(500); res.end('Error: '+e.message); }catch(ex){}
          }
        });
        zipProc.on('error', function(e){
          try{ fs.rmSync(tmpDir, {recursive:true,force:true}); }catch(ex){}
          try{ res.writeHead(500); res.end('Zip error: '+e.message); }catch(ex){}
        });
      }catch(e){
        try{ fs.rmSync(tmpDir, {recursive:true,force:true}); }catch(ex){}
        res.writeHead(500); res.end('Zip error: '+e.message);
      }
      return;
    }

    if(action === 'listdirs'){
      const targetDir = url.searchParams.get('dir') || '/';
      const targetFp = safePath(targetDir);
      if(!targetFp){ res.writeHead(400); res.end('Invalid path'); return; }
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
  if(!fs.existsSync(fp)){
    res.writeHead(404);
    res.end('<h1>404 Not Found</h1>');
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
        try{ const s=fs.statSync(itemPath); size=s.size; mtime=s.mtime; }catch(ex){}
        return {name:e.name, isDir:e.isDirectory(), size, mtime};
      });
    }catch(e){}

    const sortField = url.searchParams.get('sort') || 'name';
    const sortDir = url.searchParams.get('dir') || 'asc';
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
    const asciiName = dlName.replace(/[^\x20-\x7e]/g, '_');
    const encodedName = encodeURIComponent(dlName);
    res.writeHead(200,{
      'Content-Type':'application/octet-stream',
      'Content-Disposition':"attachment; filename=\""+asciiName+"\"; filename*=UTF-8''"+encodedName,
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
