const { esc, formatSize, itemHref } = require('./utils');
const { getIcon } = require('./file-ops');

function getHTML(list, rp, msg, sortField, sortDir, groupDirs) {
  sortField = sortField || 'name';
  sortDir = sortDir || 'asc';
  groupDirs = groupDirs !== false;

  function sortUrl(field) {
    let dir = 'asc';
    if (field === sortField) dir = sortDir === 'asc' ? 'desc' : 'asc';
    let url = '?sort=' + field + '&dir=' + dir;
    if (!groupDirs) url += '&group=0';
    return url;
  }
  function sortIcon(field) {
    if (field !== sortField) return '<span class="sort-icon"><md-icon>unfold_more</md-icon></span>';
    return '<span class="sort-icon"><md-icon>' + (sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward') + '</md-icon></span>';
  }
  function sortClass(field) {
    return field === sortField ? ' sort-active' : '';
  }

  const breadcrumbs = rp.split('/').filter(Boolean);
  let breadcrumbHtml = '<a href="/" class="breadcrumb-item"><md-icon>home</md-icon> 根目录</a>';
  const cumParts = [];
  for (const b of breadcrumbs) {
    cumParts.push(b);
    const href = '/' + cumParts.map(encodeURIComponent).join('/') + '/';
    breadcrumbHtml += '<span class="breadcrumb-sep">/</span><a href="' + href + '" class="breadcrumb-item">' + esc(b) + '</a>';
  }

  const msgHtml = msg ? '<div class="msg ' + msg.type + '">' + esc(msg.text) + '</div>' : '';
  const dirCount = list.filter(i => i.isDir).length;
  const fileCount = list.length - dirCount;
  const totalBytes = list.reduce((sum, i) => sum + (i.isDir ? 0 : i.size), 0);
  const currentLabel = breadcrumbs.length ? breadcrumbs[breadcrumbs.length - 1] : '根目录';
  const statsHtml = '<div class="header-stats">' +
    '<span class="stat-pill"><b>' + dirCount + '</b> 文件夹</span>' +
    '<span class="stat-pill"><b>' + fileCount + '</b> 文件</span>' +
    '<span class="stat-pill"><b>' + formatSize(totalBytes) + '</b></span>' +
    '</div>';

  const listHtml = list.map(i => {
    const href = itemHref(i.name, i.isDir);
    const icon = getIcon(i.name, i.isDir);
    const size = i.isDir ? '-' : formatSize(i.size);
    const mtime = i.mtime ? new Date(i.mtime).toLocaleString('zh-CN') : '-';
    const encodedName = encodeURIComponent(i.name);
    const dlBtn = i.isDir ? '' : '<md-icon-button href="' + encodedName + '?download=1" class="material-icon-button" aria-label="下载" title="下载"><md-icon>download</md-icon></md-icon-button>';
    const previewBtn = i.isDir ? '' : '<md-icon-button type="button" class="material-icon-button act-btn" data-act="preview" data-name="' + esc(i.name) + '" aria-label="预览" title="预览"><md-icon>visibility</md-icon></md-icon-button>';
    const dn = esc(i.name);
    return '<tr class="file-row" data-name="' + dn + '">' +
      '<td class="col-check"><md-checkbox touch-target="wrapper" class="row-cb" data-name="' + dn + '" aria-label="选择 ' + dn + '"></md-checkbox></td>' +
      '<td class="col-icon file-icon">' + icon + '</td>' +
      '<td class="col-name file-name"><a href="' + href + '">' + dn + '</a></td>' +
      '<td class="col-size file-size">' + size + '</td>' +
      '<td class="col-time file-time">' + mtime + '</td>' +
      '<td class="col-actions file-actions">' + previewBtn + dlBtn +
        '<md-icon-button type="button" class="material-icon-button act-btn" data-act="rename" data-name="' + dn + '" aria-label="重命名" title="重命名"><md-icon>edit</md-icon></md-icon-button>' +
        '<md-icon-button type="button" class="material-icon-button act-btn" data-act="move" data-name="' + dn + '" aria-label="移动" title="移动"><md-icon>content_cut</md-icon></md-icon-button>' +
        '<md-icon-button type="button" class="material-icon-button act-btn" data-act="copy" data-name="' + dn + '" aria-label="复制" title="复制"><md-icon>content_copy</md-icon></md-icon-button>' +
        '<md-icon-button type="button" class="material-icon-button danger act-btn" data-act="delete" data-name="' + dn + '" aria-label="删除" title="删除"><md-icon>delete</md-icon></md-icon-button></td>' +
      '</tr>';
  }).join('');

  const emptyHtml = list.length === 0 ? '<div class="empty"><md-icon>folder_open</md-icon>空目录，上传文件或新建文件夹开始使用</div>' : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#FEF7FF" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141218" media="(prefers-color-scheme: dark)">
<title>文件管理</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet">
<script type="importmap">
{"imports":{"@material/web/":"https://esm.run/@material/web/"}}
</script>
<script type="module">
import '@material/web/all.js';
import {styles as typescaleStyles} from '@material/web/typography/md-typescale-styles.js';
if('adoptedStyleSheets' in Document.prototype){
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, typescaleStyles.styleSheet];
}
</script>
<style>
:root{
  color-scheme:light;
  --md-ref-typeface-brand:Roboto,system-ui,-apple-system,'Segoe UI',sans-serif;
  --md-ref-typeface-plain:Roboto,system-ui,-apple-system,'Segoe UI',sans-serif;
  --md-sys-color-primary:#6750A4;
  --md-sys-color-on-primary:#FFFFFF;
  --md-sys-color-primary-container:#EADDFF;
  --md-sys-color-on-primary-container:#21005D;
  --md-sys-color-secondary:#625B71;
  --md-sys-color-on-secondary:#FFFFFF;
  --md-sys-color-secondary-container:#E8DEF8;
  --md-sys-color-on-secondary-container:#1D192B;
  --md-sys-color-tertiary:#7D5260;
  --md-sys-color-on-tertiary:#FFFFFF;
  --md-sys-color-tertiary-container:#FFD8E4;
  --md-sys-color-on-tertiary-container:#31111D;
  --md-sys-color-error:#B3261E;
  --md-sys-color-on-error:#FFFFFF;
  --md-sys-color-error-container:#F9DEDC;
  --md-sys-color-on-error-container:#410E0B;
  --md-sys-color-surface:#FEF7FF;
  --md-sys-color-on-surface:#1D1B20;
  --md-sys-color-surface-variant:#E7E0EC;
  --md-sys-color-on-surface-variant:#49454F;
  --md-sys-color-surface-container-lowest:#FFFFFF;
  --md-sys-color-surface-container-low:#F7F2FA;
  --md-sys-color-surface-container:#F3EDF7;
  --md-sys-color-surface-container-high:#ECE6F0;
  --md-sys-color-surface-container-highest:#E6E0E9;
  --md-sys-color-outline:#79747E;
  --md-sys-color-outline-variant:#CAC4D0;
  --md-sys-color-inverse-surface:#322F35;
  --md-sys-color-inverse-on-surface:#F5EFF7;
  --md-sys-color-inverse-primary:#D0BCFF;
  --md-sys-color-shadow:#000000;
  --md-sys-color-scrim:#000000;
}
@media(prefers-color-scheme:dark){:root{
  color-scheme:dark;
  --md-sys-color-primary:#D0BCFF;
  --md-sys-color-on-primary:#381E72;
  --md-sys-color-primary-container:#4F378B;
  --md-sys-color-on-primary-container:#EADDFF;
  --md-sys-color-secondary:#CCC2DC;
  --md-sys-color-on-secondary:#332D41;
  --md-sys-color-secondary-container:#4A4458;
  --md-sys-color-on-secondary-container:#E8DEF8;
  --md-sys-color-tertiary:#EFB8C8;
  --md-sys-color-on-tertiary:#492532;
  --md-sys-color-tertiary-container:#633B48;
  --md-sys-color-on-tertiary-container:#FFD8E4;
  --md-sys-color-error:#F2B8B5;
  --md-sys-color-on-error:#601410;
  --md-sys-color-error-container:#8C1D18;
  --md-sys-color-on-error-container:#F9DEDC;
  --md-sys-color-surface:#141218;
  --md-sys-color-on-surface:#E6E0E9;
  --md-sys-color-surface-variant:#49454F;
  --md-sys-color-on-surface-variant:#CAC4D0;
  --md-sys-color-surface-container-lowest:#0F0D13;
  --md-sys-color-surface-container-low:#1D1B20;
  --md-sys-color-surface-container:#211F26;
  --md-sys-color-surface-container-high:#2B2930;
  --md-sys-color-surface-container-highest:#36343B;
  --md-sys-color-outline:#938F99;
  --md-sys-color-outline-variant:#49454F;
  --md-sys-color-inverse-surface:#E6E0E9;
  --md-sys-color-inverse-on-surface:#322F35;
  --md-sys-color-inverse-primary:#6750A4;
}}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Roboto,system-ui,-apple-system,'Segoe UI',sans-serif;background:var(--md-sys-color-surface);color:var(--md-sys-color-on-surface);min-height:100vh;-webkit-font-smoothing:antialiased}
:not(:defined){visibility:hidden}html.ready :not(:defined){visibility:visible}
.material-symbols-outlined,md-icon{font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24}
md-icon{vertical-align:middle;line-height:1}
a{color:inherit}
::selection{background:color-mix(in srgb,var(--md-sys-color-primary) 28%,transparent)}
::-webkit-scrollbar{width:12px;height:12px}
::-webkit-scrollbar-thumb{background:var(--md-sys-color-outline-variant);border-radius:99px;border:3px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:var(--md-sys-color-outline)}

.app-bar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:16px;padding:10px 24px;min-height:64px;background:var(--md-sys-color-surface-container);border-bottom:1px solid var(--md-sys-color-outline-variant);flex-wrap:wrap}
.app-bar-main{display:flex;align-items:center;gap:18px;min-width:0;flex:1}
.brand{display:flex;align-items:center;gap:12px;flex-shrink:0}
.brand-mark{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.brand-mark md-icon{--md-icon-size:26px}
.brand-copy{display:flex;flex-direction:column;line-height:1.15}
.app-bar h1{margin:0;font-size:22px;font-weight:500;letter-spacing:0;color:var(--md-sys-color-on-surface)}
.subtitle{font-size:13px;color:var(--md-sys-color-on-surface-variant);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.breadcrumb{display:flex;align-items:center;flex-wrap:wrap;gap:2px;min-width:0}
.breadcrumb-item{display:inline-flex;align-items:center;gap:4px;font-size:13px;color:var(--md-sys-color-on-surface-variant);text-decoration:none;padding:6px 12px;border-radius:99px;transition:background .15s,color .15s}
.breadcrumb-item md-icon{font-size:18px}
.breadcrumb-item:hover{background:var(--md-sys-color-surface-container-highest);color:var(--md-sys-color-on-surface)}
.breadcrumb-sep{color:var(--md-sys-color-outline);font-size:14px}
.header-stats{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.stat-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:8px;border:1px solid var(--md-sys-color-outline-variant);font-size:12px;color:var(--md-sys-color-on-surface-variant);background:var(--md-sys-color-surface-container-low);white-space:nowrap}
.stat-pill b{color:var(--md-sys-color-on-surface);font-weight:600}

.container{max-width:1240px;margin:0 auto;padding:24px}
.toolbar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
md-filled-button md-icon,md-filled-tonal-button md-icon,md-outlined-button md-icon,md-text-button md-icon,md-elevated-button md-icon{font-size:18px}

.material-icon-button{width:40px;height:40px;color:var(--md-sys-color-on-surface-variant);--md-icon-button-icon-size:18px;--md-icon-button-state-layer-width:40px;--md-icon-button-state-layer-height:40px}
.material-icon-button md-icon{font-size:18px}
.material-icon-button.danger{color:var(--md-sys-color-error)}

.msg{display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:12px;margin-bottom:16px;font-size:14px}
.msg.success{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}
.msg.error{background:var(--md-sys-color-error-container);color:var(--md-sys-color-on-error-container)}

.table-wrap{background:var(--md-sys-color-surface-container-low);border:1px solid var(--md-sys-color-outline-variant);border-radius:16px;overflow:hidden}
table{width:100%;border-collapse:separate;border-spacing:0}
th{text-align:left;font-size:12px;font-weight:500;letter-spacing:.04em;color:var(--md-sys-color-on-surface-variant);padding:14px 16px;background:var(--md-sys-color-surface-container);border-bottom:1px solid var(--md-sys-color-outline-variant)}
td{padding:8px 16px;font-size:14px;vertical-align:middle;border-bottom:1px solid var(--md-sys-color-outline-variant);color:var(--md-sys-color-on-surface)}
tr:last-child td{border-bottom:0}
.file-row{transition:background .12s}
.file-row:hover{background:color-mix(in srgb,var(--md-sys-color-on-surface) 7%,transparent)}
tr.selected{background:color-mix(in srgb,var(--md-sys-color-primary) 12%,transparent)!important}
.col-check{width:48px;text-align:center}
.col-icon{width:48px}
.file-icon{text-align:center}
.file-icon md-icon{font-size:24px}
.file-name a{color:var(--md-sys-color-on-surface);text-decoration:none;font-weight:500;word-break:break-word}
.file-name a:hover{color:var(--md-sys-color-primary);text-decoration:underline}
.file-size,.file-time{color:var(--md-sys-color-on-surface-variant);font-size:13px;white-space:nowrap}
.file-actions{text-align:right;white-space:nowrap}
.empty{text-align:center;padding:64px 20px;color:var(--md-sys-color-on-surface-variant);font-size:15px}
.empty md-icon{--md-icon-size:48px;display:block;margin:0 auto 12px;opacity:.6}

.fic{color:var(--md-sys-color-on-surface-variant)}
.fic-folder{color:var(--md-sys-color-primary)}
.fic-blue{color:#5B8DEF}
.fic-green{color:#3FA66A}
.fic-violet{color:#9B6FE8}
.fic-amber{color:#E0A33E}
.fic-rose{color:#E5709B}
.fic-cyan{color:#3AAFC0}

.sortable{cursor:pointer;user-select:none}
.sortable a{display:inline-flex;align-items:center;gap:4px;color:var(--md-sys-color-on-surface-variant);text-decoration:none}
.sortable:hover a{color:var(--md-sys-color-on-surface)}
.sort-active a{color:var(--md-sys-color-primary)}
.sort-icon{display:inline-flex;align-items:center}
.sort-icon md-icon{font-size:16px}
.sortable:not(.sort-active) .sort-icon{opacity:.4}

.material-dialog{--md-dialog-container-color:var(--md-sys-color-surface-container-high);min-width:min(560px,calc(100vw - 48px));max-width:560px}
.dialog-headline{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:500}
.dialog-headline md-icon{color:var(--md-sys-color-primary)}
.dialog-content{display:flex;flex-direction:column;gap:16px}
.dialog-support{font-size:14px;color:var(--md-sys-color-on-surface-variant);word-break:break-all}
.modal-actions{display:flex;gap:8px;justify-content:flex-end}
md-outlined-text-field{width:100%}
.upload-area{border:2px dashed var(--md-sys-color-outline);border-radius:16px;padding:36px 20px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;background:var(--md-sys-color-surface-container-low)}
.upload-area:hover,.upload-area.dragover{border-color:var(--md-sys-color-primary);background:color-mix(in srgb,var(--md-sys-color-primary) 8%,transparent)}
.upload-area md-icon{--md-icon-size:46px;color:var(--md-sys-color-primary)}
.upload-area p{margin:10px 0 4px;font-size:15px;font-weight:500;color:var(--md-sys-color-on-surface)}
.drop-zone-hint{font-size:13px;color:var(--md-sys-color-on-surface-variant)}
#uploadProgress{display:flex;flex-direction:column;gap:8px}
#progressBar{--md-linear-progress-track-height:8px;--md-linear-progress-active-indicator-height:8px}
#progressText{font-size:13px;color:var(--md-sys-color-on-surface-variant);text-align:center}

/* Floating transfer panel */
.transfer-panel{position:fixed;bottom:20px;right:20px;z-index:200;width:420px;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.12);background:var(--md-sys-color-surface-container-high);border:1px solid var(--md-sys-color-outline-variant);overflow:hidden;transition:opacity .2s,transform .2s;transform-origin:bottom right}
.transfer-panel.hidden{opacity:0;pointer-events:none;transform:scale(.92)}
.tp-header{display:flex;align-items:center;gap:8px;padding:12px 14px;cursor:pointer;user-select:none;background:var(--md-sys-color-surface-container);border-bottom:1px solid var(--md-sys-color-outline-variant);position:relative}
.tp-header-bar{position:absolute;bottom:0;left:0;height:3px;background:var(--md-sys-color-primary);transition:width .3s ease;border-radius:0 2px 0 0;opacity:0}
.tp-header-bar.active{opacity:1}
.tp-header-bar.done{background:#3FA66A;transition:width .15s ease,background .3s}
.tp-header-info{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--md-sys-color-on-surface-variant);min-width:0;flex:1;overflow:hidden}
.tp-header-info-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.tp-header-info-pct{flex-shrink:0;white-space:nowrap;font-weight:500;color:var(--md-sys-color-primary)}
.tp-header:hover{background:var(--md-sys-color-surface-container-high)}
.tp-header md-icon{font-size:20px;color:var(--md-sys-color-primary)}
.tp-title{font-size:14px;font-weight:500;flex-shrink:0}
.tp-count{font-size:12px;color:var(--md-sys-color-on-surface-variant);background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container);padding:2px 8px;border-radius:99px}
.tp-toggle md-icon{font-size:20px;color:var(--md-sys-color-on-surface-variant);transition:transform .2s}
.tp-toggle.collapsed md-icon{transform:rotate(180deg)}
.tp-body{max-height:280px;overflow-y:auto}
.tp-body.collapsed{display:none}
.tp-empty{padding:20px;text-align:center;font-size:13px;color:var(--md-sys-color-on-surface-variant)}
.tp-group-label{font-size:11px;font-weight:500;letter-spacing:.04em;color:var(--md-sys-color-on-surface-variant);padding:8px 14px 4px;text-transform:uppercase}
.tp-item{display:flex;align-items:center;gap:10px;padding:8px 14px;font-size:13px;border-bottom:1px solid color-mix(in srgb,var(--md-sys-color-outline-variant) 50%,transparent)}
.tp-item:last-child{border-bottom:0}
.tp-item-icon{flex-shrink:0;width:20px;text-align:center}
.tp-item-icon md-icon{font-size:18px}
.tp-item-icon.waiting md-icon{color:var(--md-sys-color-outline)}
.tp-item-icon.active md-icon{color:var(--md-sys-color-primary);animation:spin 1s linear infinite}
.tp-item-icon.done md-icon{color:#3FA66A}
.tp-item-icon.error md-icon{color:var(--md-sys-color-error)}
.tp-item-info{flex:1;min-width:0}
.tp-item-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.tp-item-detail{font-size:11px;color:var(--md-sys-color-on-surface-variant);margin-top:1px}
.tp-item-status{flex-shrink:0;font-size:12px}
.tp-item-status.done{color:#3FA66A}
.tp-item-status.error{color:var(--md-sys-color-error)}

@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}

.preview-overlay{position:fixed;inset:0;z-index:300;display:flex;justify-content:center;align-items:center;flex-direction:column;padding:24px;visibility:hidden;opacity:0;transition:opacity .2s;background:color-mix(in srgb,var(--md-sys-color-scrim) 78%,transparent);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);pointer-events:none}
.preview-overlay.show{visibility:visible;opacity:1;pointer-events:auto}
.preview-overlay img,.preview-overlay video,.preview-overlay audio{border-radius:16px;max-width:min(92vw,1200px);max-height:80vh;box-shadow:0 24px 60px rgba(0,0,0,.5)}
.preview-overlay pre{border-radius:16px;padding:20px;overflow:auto;font-size:13px;line-height:1.6;background:var(--md-sys-color-surface-container-high);color:var(--md-sys-color-on-surface);max-width:min(92vw,1100px);max-height:80vh;white-space:pre-wrap;word-break:break-word}
.preview-close{position:absolute;top:16px;right:20px;z-index:301;color:#fff;--md-icon-button-icon-size:24px}
.preview-close md-icon{font-size:24px}
.preview-name{color:rgba(255,255,255,.92);margin-top:12px;font-size:14px;max-width:90vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%) translateY(-10px);padding:14px 18px;border-radius:8px;font-size:14px;z-index:999;opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;background:var(--md-sys-color-inverse-surface);color:var(--md-sys-color-inverse-on-surface);box-shadow:0 6px 20px rgba(0,0,0,.3)}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

.clipboard-bar{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;margin-bottom:16px;font-size:14px;flex-wrap:wrap}
.clipboard-bar md-icon{font-size:18px}
.clipboard-bar.move{background:var(--md-sys-color-tertiary-container);color:var(--md-sys-color-on-tertiary-container)}
.clipboard-bar.copy{background:var(--md-sys-color-secondary-container);color:var(--md-sys-color-on-secondary-container)}

.batch-bar{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:16px;margin-bottom:16px;font-size:14px;flex-wrap:wrap;background:var(--md-sys-color-primary-container);color:var(--md-sys-color-on-primary-container)}
.batch-bar b{font-weight:600}
.batch-bar md-outlined-button{--md-outlined-button-label-text-color:var(--md-sys-color-on-primary-container);--md-outlined-button-outline-color:color-mix(in srgb,var(--md-sys-color-on-primary-container) 40%,transparent)}

@media(max-width:860px){
  .app-bar{padding:10px 16px;gap:10px}
  .app-bar-main{flex-direction:column;align-items:flex-start;gap:10px;width:100%}
  .subtitle{max-width:70vw}
  .header-stats{width:100%;justify-content:flex-start}
  .container{padding:14px}
  .col-size,.col-time{display:none}
  th,td{padding:8px}
  .col-icon{width:40px}
  .col-check{width:40px}
  .file-actions{gap:0}
  .material-dialog{min-width:calc(100vw - 24px)}
}
</style>
</head>
<body>
<div id="toast" class="toast"></div>
<div class="app-bar">
  <div class="app-bar-main">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true"><md-icon>folder_open</md-icon></div>
      <div class="brand-copy">
        <h1>winFM</h1>
        <div class="subtitle">${esc(currentLabel)}</div>
      </div>
    </div>
    <div class="breadcrumb">${breadcrumbHtml}</div>
  </div>
  ${statsHtml}
</div>
<div class="container">
  ${msgHtml}
  <div class="toolbar">
    <md-filled-button type="button" onclick="showUpload()"><md-icon slot="icon">upload</md-icon>上传文件</md-filled-button>
    <md-filled-tonal-button type="button" onclick="showNewFolder()"><md-icon slot="icon">create_new_folder</md-icon>新建文件夹</md-filled-tonal-button>
    <md-outlined-button type="button" onclick="location.reload()"><md-icon slot="icon">refresh</md-icon>刷新</md-outlined-button>
    <${groupDirs?'md-filled-tonal-button':'md-outlined-button'} href="?sort=${sortField}&dir=${sortDir}&group=${groupDirs?0:1}" class="group-toggle" title="切换目录优先显示"><md-icon slot="icon">account_tree</md-icon>目录优先</${groupDirs?'md-filled-tonal-button':'md-outlined-button'}>
    <span id="toolbarPaste"></span>
  </div>
  <div id="batchBar"></div>
  <div id="clipboardBar"></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th class="col-check"><md-checkbox touch-target="wrapper" id="selectAll" aria-label="选择全部"></md-checkbox></th><th class="col-icon"></th><th class="col-name sortable${sortClass('name')}"><a href="${sortUrl('name')}">名称${sortIcon('name')}</a></th><th class="col-size sortable${sortClass('size')}" style="width:90px"><a href="${sortUrl('size')}">大小${sortIcon('size')}</a></th><th class="col-time sortable${sortClass('mtime')}" style="width:170px"><a href="${sortUrl('mtime')}">修改时间${sortIcon('mtime')}</a></th><th class="col-actions" style="width:220px">操作</th></tr></thead>
      <tbody>
        ${rp !== '/' ? '<tr class="file-row"><td class="col-check"></td><td class="col-icon file-icon"><md-icon class="fic">drive_folder_upload</md-icon></td><td class="col-name file-name"><a href="../">返回上级</a></td><td class="col-size">-</td><td class="col-time">-</td><td class="col-actions"></td></tr>' : ''}
        ${listHtml}
      </tbody>
    </table>
    ${emptyHtml}
  </div>
</div>

<!-- Upload Dialog -->
<md-dialog id="uploadModal" class="material-dialog">
  <div slot="headline" class="dialog-headline"><md-icon>upload</md-icon><span>上传文件</span></div>
  <div slot="content" class="dialog-content">
    <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()">
      <div class="icon"><md-icon>cloud_upload</md-icon></div>
      <p>点击选择文件，或拖拽文件到这里</p>
      <div class="drop-zone-hint">支持多文件上传</div>
    </div>
    <input type="file" id="fileInput" multiple style="display:none">
    <div id="uploadProgress" style="display:none">
      <md-linear-progress id="progressBar" value="0" aria-label="上传进度"></md-linear-progress>
      <div id="progressText"></div>
    </div>
  </div>
  <div slot="actions" class="modal-actions">
    <md-text-button type="button" onclick="closeModal('uploadModal')">取消</md-text-button>
  </div>
</md-dialog>

<!-- New Folder Dialog -->
<md-dialog id="folderModal" class="material-dialog">
  <div slot="headline" class="dialog-headline"><md-icon>create_new_folder</md-icon><span>新建文件夹</span></div>
  <div slot="content" class="dialog-content">
    <md-outlined-text-field id="folderName" label="文件夹名称" placeholder="输入文件夹名称"></md-outlined-text-field>
  </div>
  <div slot="actions" class="modal-actions">
    <md-text-button type="button" onclick="closeModal('folderModal')">取消</md-text-button>
    <md-filled-button type="button" onclick="createFolder()">创建</md-filled-button>
  </div>
</md-dialog>

<!-- Rename Dialog -->
<md-dialog id="renameModal" class="material-dialog">
  <div slot="headline" class="dialog-headline"><md-icon>edit</md-icon><span>重命名</span></div>
  <div slot="content" class="dialog-content">
    <div id="renameOldName" class="dialog-support"></div>
    <md-outlined-text-field id="renameNewName" label="新名称" placeholder="输入新名称"></md-outlined-text-field>
  </div>
  <div slot="actions" class="modal-actions">
    <md-text-button type="button" onclick="closeModal('renameModal')">取消</md-text-button>
    <md-filled-button type="button" onclick="doRename()">确定</md-filled-button>
  </div>
</md-dialog>

<!-- Preview Modal -->
<div class="preview-overlay" id="previewOverlay">
  <md-icon-button class="preview-close" onclick="closePreview()" aria-label="关闭预览"><md-icon>close</md-icon></md-icon-button>
  <div id="previewContent"></div>
  <div class="preview-name" id="previewName"></div>
</div>

<script>
const currentPath = location.pathname;
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function refreshIcons(){}

function showDialog(id){
  const dialog = document.getElementById(id);
  if(!dialog) return;
  if(dialog.open) return;
  if(typeof dialog.show === 'function') dialog.show();
  else dialog.setAttribute('open', '');
}
function closeModal(id){
  const dialog = document.getElementById(id);
  if(!dialog) return;
  if(typeof dialog.close === 'function' && dialog.open) dialog.close();
  else dialog.removeAttribute('open');
}
function showUpload(){showDialog('uploadModal')}
function showNewFolder(){
  showDialog('folderModal');
  setTimeout(function(){document.getElementById('folderName').focus()},100);
}

function closePreview(){document.getElementById('previewOverlay').classList.remove('show');document.getElementById('previewContent').innerHTML=''}

document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal('uploadModal');closeModal('folderModal');closeModal('renameModal');closePreview()}});

// Event delegation for action buttons
document.addEventListener('click', function(e){
  // Intercept single file download links
  var dlLink = e.target.closest('a[href$="?download=1"]');
  if(dlLink && dlLink.closest('.file-row')){
    e.preventDefault();
    var dlHref = dlLink.getAttribute('href');
    var dlName = decodeURIComponent(dlHref.replace('?download=1',''));
    var tpId = addTransferItem({ name: dlName, size: 0, type: 'download', detail: '下载中...' });
    updateTransferItem(tpId, { status: 'active' });
    // Trigger actual download
    var a = document.createElement('a');
    a.href = dlHref;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){ document.body.removeChild(a); }, 1000);
    updateTransferItem(tpId, { status: 'done', detail: '完成' });
    setTimeout(function(){ removeTransferItem(tpId); }, 3000);
    return;
  }

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
    '<md-filled-tonal-button type="button" class="act-btn" data-act="batch-download"><md-icon slot="icon">download</md-icon>全部下载</md-filled-tonal-button>'+
    '<md-filled-tonal-button type="button" class="act-btn" data-act="batch-copy"><md-icon slot="icon">content_copy</md-icon>批量复制</md-filled-tonal-button>'+
    '<md-filled-tonal-button type="button" class="act-btn" data-act="batch-move"><md-icon slot="icon">content_cut</md-icon>批量移动</md-filled-tonal-button>'+
    '<md-outlined-button type="button" class="act-btn" data-act="batch-delete"><md-icon slot="icon">delete</md-icon>批量删除</md-outlined-button>'+
    '<md-outlined-button type="button" class="act-btn" data-act="batch-clear" style="margin-left:auto"><md-icon slot="icon">close</md-icon>取消选择</md-outlined-button>'+
    '</div>';
  refreshIcons();
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
  if(selectAll){
    selectAll.checked = cbs.length > 0 && selectedItems.size === cbs.length;
    selectAll.indeterminate = selectedItems.size > 0 && selectedItems.size < cbs.length;
  }
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
    if(selectAll){
      selectAll.checked = cbs.length > 0 && selectedItems.size === cbs.length;
      selectAll.indeterminate = selectedItems.size > 0 && selectedItems.size < cbs.length;
    }
  }
});

async function batchDownload(){
  var names = Array.from(selectedItems);
  if(!names.length) return;

  var tpIds = [];
  for(var i=0;i<names.length;i++){
    tpIds.push(addTransferItem({ name: names[i], size: 0, type: 'download' }));
  }
  showToast('开始下载 '+names.length+' 项...', 'info');

  var okCount = 0, failCount = 0;
  for(var i=0;i<names.length;i++){
    var name = names[i];
    var idx = i+1;
    updateTransferItem(tpIds[i], { status: 'active', detail: '下载中 ' + idx + '/' + names.length });
    try{
      var r = await fetch(currentPath + encodeURIComponent(name) + '?download=1');
      if(!r.ok){ throw new Error('HTTP ' + r.status); }
      var blob = await r.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      (function(u){
        setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(u); }, 60000);
      })(url);
      updateTransferItem(tpIds[i], { status: 'done', progress: 100, detail: formatSize(blob.size) + ' · 完成' });
      okCount++;
    }catch(e){
      updateTransferItem(tpIds[i], { status: 'error', detail: e.message || '下载失败' });
      failCount++;
    }
  }

  if(failCount === 0){
    showToast('全部下载完成，共 '+okCount+' 个文件', 'success');
  } else {
    showToast('下载结束：成功 '+okCount+'，失败 '+failCount, 'info');
  }
  setTimeout(function(){ tpIds.forEach(function(id){ removeTransferItem(id); }); }, 5000);
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

  // Add to floating transfer panel
  var tpIds = [];
  for(var i=0;i<files.length;i++){
    tpIds.push(addTransferItem({ name: files[i].name, size: files[i].size, type: 'upload' }));
  }

  var okCount = 0, failCount = 0;
  for(var i=0;i<files.length;i++){
    var file = files[i];
    var idx = i+1;
    updateTransferItem(tpIds[i], { status: 'active', detail: formatSize(file.size) });
    text.textContent = '上传 ' + idx + '/' + files.length + '  ' + file.name;
    bar.value = totalSize ? uploadedSize/totalSize : i/files.length;
    try{
      await uploadFile(file, function(loaded, total){
        var pct = totalSize ? Math.round((uploadedSize + loaded) / totalSize * 100) : Math.round(idx/files.length*100);
        bar.value = pct / 100;
        text.textContent = '上传 ' + idx + '/' + files.length + '  ' + file.name + '  ' + formatSize(loaded) + '/' + formatSize(total);
        updateTransferItem(tpIds[i], { progress: total ? loaded/total*100 : 0, detail: formatSize(loaded) + '/' + formatSize(total) });
      });
      uploadedSize += file.size;
      updateTransferItem(tpIds[i], { status: 'done', progress: 100, detail: '完成' });
      okCount++;
    }catch(e){
      updateTransferItem(tpIds[i], { status: 'error', detail: e.message || '上传失败' });
      failCount++;
    }
  }
  bar.value = 1;
  if(failCount === 0){
    text.textContent = '上传完成！共 ' + files.length + ' 个文件';
    showToast('上传完成，共 ' + okCount + ' 个文件', 'success');
  } else {
    text.textContent = '上传结束：成功 ' + okCount + '，失败 ' + failCount;
    showToast('上传结束：成功 ' + okCount + '，失败 ' + failCount, 'info');
  }
  // Auto-remove completed items after 5s
  setTimeout(function(){
    tpIds.forEach(function(id){ removeTransferItem(id); });
  }, 5000);
  setTimeout(function(){ location.reload(); }, failCount > 0 ? 3000 : 800);
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
  showDialog('renameModal');
  setTimeout(()=>{input.focus();if(typeof input.select === 'function') input.select()},100);
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
  var icon = isMove ? '<md-icon>content_cut</md-icon>' : '<md-icon>content_copy</md-icon>';
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
  var cancelBtn = document.createElement('md-text-button');
  cancelBtn.className = 'act-btn';
  cancelBtn.setAttribute('type', 'button');
  cancelBtn.setAttribute('data-act', 'cancel-clip');
  cancelBtn.style.cssText = 'margin-left:auto;opacity:0.8';
  cancelBtn.innerHTML = '<md-icon slot="icon">close</md-icon>取消';
  bar.querySelector('.clipboard-bar').appendChild(cancelBtn);
  // Paste button in toolbar
  toolbar.innerHTML = '';
  var pasteBtn = document.createElement('md-filled-button');
  pasteBtn.className = 'act-btn';
  pasteBtn.setAttribute('type', 'button');
  pasteBtn.setAttribute('data-act', 'paste');
  pasteBtn.innerHTML = '<md-icon slot="icon">content_paste</md-icon>粘贴到此处';
  toolbar.appendChild(pasteBtn);
  refreshIcons();
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
// ── Transfer Queue Manager ──
var transferItems = [];
var transferIdCounter = 0;
var tpCollapsed = false;

function addTransferItem(opts) {
  var id = ++transferIdCounter;
  var item = {
    id: id,
    name: opts.name || '',
    size: opts.size || 0,
    type: opts.type || 'upload', // 'upload' or 'download'
    status: 'waiting', // waiting, active, done, error
    progress: 0,
    detail: opts.detail || '',
    el: null
  };
  transferItems.push(item);
  renderTransferPanel();
  showTransferPanel();
  return id;
}
function updateTransferItem(id, updates) {
  for (var i = 0; i < transferItems.length; i++) {
    if (transferItems[i].id === id) {
      for (var k in updates) transferItems[i][k] = updates[k];
      break;
    }
  }
  // If only progress/detail changed (no status change), do a lightweight DOM update
  if ('status' in updates) {
    renderTransferPanel();
  } else {
    renderTransferProgress(id);
  }
}
function removeTransferItem(id) {
  transferItems = transferItems.filter(function(t) { return t.id !== id; });
  renderTransferPanel();
  if (!transferItems.length) hideTransferPanel();
}
function getTransferIcon(status) {
  if (status === 'waiting') return 'hourglass_empty';
  if (status === 'active') return 'sync';
  if (status === 'done') return 'check_circle';
  if (status === 'error') return 'error';
  return 'radio_button_unchecked';
}
function updateHeaderBar() {
  var countEl = document.getElementById('tpCount');
  var barEl = document.getElementById('tpBar');
  var infoEl = document.getElementById('tpInfo');
  if (!countEl) return;
  var active = transferItems.filter(function(t) { return t.status === 'active' || t.status === 'waiting'; });
  var doneItems = transferItems.filter(function(t) { return t.status === 'done'; });
  var errorItems = transferItems.filter(function(t) { return t.status === 'error'; });
  countEl.textContent = active.length || transferItems.length;

  if (barEl) {
    if (!transferItems.length) {
      barEl.className = 'tp-header-bar';
      barEl.style.width = '0';
    } else if (active.length) {
      var totalProgress = 0, activeCount = 0;
      transferItems.forEach(function(t) {
        if (t.status === 'active') { totalProgress += t.progress; activeCount++; }
        else if (t.status === 'waiting') { activeCount++; }
        else if (t.status === 'done') { totalProgress += 100; activeCount++; }
      });
      var pct = activeCount ? Math.round(totalProgress / activeCount) : 0;
      barEl.className = 'tp-header-bar active';
      barEl.style.width = pct + '%';
    } else {
      barEl.className = 'tp-header-bar done';
      barEl.style.width = '100%';
    }
  }

  if (infoEl) {
    var nameEl = infoEl.querySelector('.tp-header-info-name');
    var pctEl = infoEl.querySelector('.tp-header-info-pct');
    if (!nameEl) { infoEl.innerHTML = '<span class="tp-header-info-name"></span><span class="tp-header-info-pct"></span>'; nameEl = infoEl.querySelector('.tp-header-info-name'); pctEl = infoEl.querySelector('.tp-header-info-pct'); }
    if (active.length) {
      var current = transferItems.find(function(t) { return t.status === 'active'; });
      if (current) {
        nameEl.textContent = current.name;
        pctEl.textContent = Math.round(current.progress) + '%';
      } else {
        nameEl.textContent = active.length + ' 项等待中';
        pctEl.textContent = '';
      }
    } else if (doneItems.length || errorItems.length) {
      var parts = [];
      if (doneItems.length) parts.push(doneItems.length + ' 完成');
      if (errorItems.length) parts.push(errorItems.length + ' 失败');
      nameEl.textContent = parts.join('，');
      pctEl.textContent = '';
    } else {
      nameEl.textContent = '';
      pctEl.textContent = '';
    }
  }
}

function buildItemHtml(t) {
  var pct = t.status === 'active' ? ' (' + Math.round(t.progress) + '%)' : '';
  var statusLabel = t.status === 'waiting' ? '等待中' : t.status === 'active' ? '传输中' + pct : t.status === 'done' ? '完成' : '失败';
  var detail = t.detail || formatSize(t.size);
  return '<div class="tp-item" data-tid="' + t.id + '"><div class="tp-item-icon ' + t.status + '"><md-icon>' + getTransferIcon(t.status) + '</md-icon></div>' +
    '<div class="tp-item-info"><div class="tp-item-name">' + esc(t.name) + '</div><div class="tp-item-detail">' + esc(detail) + '</div></div>' +
    '<div class="tp-item-status ' + t.status + '">' + statusLabel + '</div></div>';
}

function fullRenderBody() {
  var body = document.getElementById('tpBody');
  if (!body) return;
  if (!transferItems.length) {
    body.innerHTML = '<div class="tp-empty">暂无传输任务</div>';
    return;
  }
  var uploads = transferItems.filter(function(t) { return t.type === 'upload'; });
  var downloads = transferItems.filter(function(t) { return t.type === 'download'; });
  var html = '';
  if (uploads.length) {
    html += '<div class="tp-group-label">上传</div>';
    uploads.forEach(function(t) { html += buildItemHtml(t); });
  }
  if (downloads.length) {
    html += '<div class="tp-group-label">下载</div>';
    downloads.forEach(function(t) { html += buildItemHtml(t); });
  }
  body.innerHTML = html;
}

function updateItemDom(t) {
  var el = document.querySelector('.tp-item[data-tid="' + t.id + '"]');
  if (!el) return;
  var iconEl = el.querySelector('.tp-item-icon');
  var detailEl = el.querySelector('.tp-item-detail');
  var statusEl = el.querySelector('.tp-item-status');
  if (iconEl) {
    iconEl.className = 'tp-item-icon ' + t.status;
    // Only update icon text when status type changes (not on every progress tick)
    var iconName = getTransferIcon(t.status);
    if (iconEl.querySelector('md-icon') && iconEl.querySelector('md-icon').textContent !== iconName) {
      iconEl.querySelector('md-icon').textContent = iconName;
    }
  }
  if (detailEl) {
    var detail = t.detail || formatSize(t.size);
    if (detailEl.textContent !== detail) detailEl.textContent = detail;
  }
  if (statusEl) {
    var pct = t.status === 'active' ? ' (' + Math.round(t.progress) + '%)' : '';
    var statusLabel = t.status === 'waiting' ? '等待中' : t.status === 'active' ? '传输中' + pct : t.status === 'done' ? '完成' : '失败';
    statusEl.className = 'tp-item-status ' + t.status;
    if (statusEl.textContent !== statusLabel) statusEl.textContent = statusLabel;
  }
}

function renderTransferPanel() {
  updateHeaderBar();
  fullRenderBody();
}

function renderTransferProgress(id) {
  updateHeaderBar();
  var item = null;
  for (var i = 0; i < transferItems.length; i++) {
    if (transferItems[i].id === id) { item = transferItems[i]; break; }
  }
  if (item) updateItemDom(item);
}
function showTransferPanel() {
  var p = document.getElementById('transferPanel');
  if (p) p.classList.remove('hidden');
}
function hideTransferPanel() {
  var p = document.getElementById('transferPanel');
  if (p) p.classList.add('hidden');
}
function toggleTransferPanel() {
  tpCollapsed = !tpCollapsed;
  var body = document.getElementById('tpBody');
  var toggle = document.getElementById('tpToggle');
  if (body) body.classList.toggle('collapsed', tpCollapsed);
  if (toggle) toggle.classList.toggle('collapsed', tpCollapsed);
}

// Initialize clipboard bar on page load
window.addEventListener('load', function(){
  try{ renderClipboard(); }catch(e){ console.error('renderClipboard error:', e); }
  refreshIcons();
});
// Also try immediately
try{ renderClipboard(); }catch(e){}
refreshIcons();
// 兜底：CDN 加载失败时仍显示未升级的组件（隐藏只作用于未定义元素，不再整页隐藏）
setTimeout(function(){ document.documentElement.classList.add('ready'); }, 2000);
</script>

<!-- Floating Transfer Panel -->
<div class="transfer-panel hidden" id="transferPanel">
  <div class="tp-header" onclick="toggleTransferPanel()">
    <md-icon>swap_vert</md-icon>
    <span class="tp-title">传输队列</span>
    <span class="tp-header-info" id="tpInfo"></span>
    <span class="tp-count" id="tpCount">0</span>
    <span class="tp-toggle" id="tpToggle"><md-icon>expand_more</md-icon></span>
    <div class="tp-header-bar" id="tpBar"></div>
  </div>
  <div class="tp-body" id="tpBody">
    <div class="tp-empty" id="tpEmpty">暂无传输任务</div>
  </div>
</div>

</body>
</html>`;
}

module.exports = { getHTML };
