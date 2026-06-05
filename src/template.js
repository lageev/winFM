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
    if (field !== sortField) return '<span class="sort-icon"><i data-lucide="chevrons-up-down"></i></span>';
    return '<span class="sort-icon"><i data-lucide="' + (sortDir === 'asc' ? 'chevron-up' : 'chevron-down') + '"></i></span>';
  }
  function sortClass(field) {
    return field === sortField ? ' sort-active' : '';
  }

  const breadcrumbs = rp.split('/').filter(Boolean);
  let breadcrumbHtml = '<a href="/" class="breadcrumb-item"><i data-lucide="house"></i> 根目录</a>';
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
    const dlBtn = i.isDir ? '' : '<md-icon-button href="' + encodedName + '?download=1" class="material-icon-button" aria-label="下载" title="下载"><i data-lucide="download"></i></md-icon-button>';
    const previewBtn = i.isDir ? '' : '<md-icon-button type="button" class="material-icon-button act-btn" data-act="preview" data-name="' + esc(i.name) + '" aria-label="预览" title="预览"><i data-lucide="eye"></i></md-icon-button>';
    const dn = esc(i.name);
    return '<tr class="file-row" data-name="' + dn + '">' +
      '<td class="col-check"><md-checkbox touch-target="wrapper" class="row-cb" data-name="' + dn + '" aria-label="选择 ' + dn + '"></md-checkbox></td>' +
      '<td class="col-icon file-icon">' + icon + '</td>' +
      '<td class="col-name file-name"><a href="' + href + '">' + dn + '</a></td>' +
      '<td class="col-size file-size">' + size + '</td>' +
      '<td class="col-time file-time">' + mtime + '</td>' +
      '<td class="col-actions file-actions">' + previewBtn + dlBtn +
        '<md-icon-button type="button" class="material-icon-button act-btn" data-act="rename" data-name="' + dn + '" aria-label="重命名" title="重命名"><i data-lucide="pencil"></i></md-icon-button>' +
        '<md-icon-button type="button" class="material-icon-button act-btn" data-act="move" data-name="' + dn + '" aria-label="移动" title="移动"><i data-lucide="scissors"></i></md-icon-button>' +
        '<md-icon-button type="button" class="material-icon-button act-btn" data-act="copy" data-name="' + dn + '" aria-label="复制" title="复制"><i data-lucide="copy"></i></md-icon-button>' +
        '<md-icon-button type="button" class="material-icon-button danger act-btn" data-act="delete" data-name="' + dn + '" aria-label="删除" title="删除"><i data-lucide="trash-2"></i></md-icon-button></td>' +
      '</tr>';
  }).join('');

  const emptyHtml = list.length === 0 ? '<div class="empty"><i data-lucide="folder-open"></i>空目录，上传文件或新建文件夹开始使用</div>' : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a0e16" media="(prefers-color-scheme: dark)">
<title>文件管理</title>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
<style>html{background:#f7f8fb}@media(prefers-color-scheme:dark){html{background:#0a0e16}}body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif}</style>
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config={darkMode:'media',theme:{extend:{
  colors:{
    border:'hsl(var(--border))',input:'hsl(var(--input))',ring:'hsl(var(--ring))',
    background:'hsl(var(--background))',foreground:'hsl(var(--foreground))',
    primary:{DEFAULT:'hsl(var(--primary))',foreground:'hsl(var(--primary-foreground))'},
    secondary:{DEFAULT:'hsl(var(--secondary))',foreground:'hsl(var(--secondary-foreground))'},
    muted:{DEFAULT:'hsl(var(--muted))',foreground:'hsl(var(--muted-foreground))'},
    accent:{DEFAULT:'hsl(var(--accent))',foreground:'hsl(var(--accent-foreground))'},
    destructive:{DEFAULT:'hsl(var(--destructive))',foreground:'hsl(var(--destructive-foreground))'},
    success:{DEFAULT:'hsl(var(--success))',foreground:'hsl(var(--success-foreground))'},
    warning:{DEFAULT:'hsl(var(--warning))',foreground:'hsl(var(--warning-foreground))'},
    card:{DEFAULT:'hsl(var(--card))',foreground:'hsl(var(--card-foreground))'}
  },
  borderRadius:{lg:'var(--radius)',md:'calc(var(--radius) - 2px)',sm:'calc(var(--radius) - 4px)'},
  fontFamily:{sans:['Inter','-apple-system','BlinkMacSystemFont','Segoe UI','Roboto','Helvetica Neue','Arial','sans-serif']}
}}};
</script>
<script src="https://unpkg.com/lucide@latest"></script>
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
<style type="text/tailwindcss">
@layer base{
:root{
  color-scheme:light;
  --background:210 40% 98%;--foreground:222 47% 11%;
  --card:0 0% 100%;--card-foreground:222 47% 11%;
  --primary:222 47% 11%;--primary-foreground:210 40% 98%;
  --secondary:214 32% 95%;--secondary-foreground:222 47% 11%;
  --muted:214 32% 95%;--muted-foreground:215 16% 47%;
  --accent:217 91% 60%;--accent-foreground:0 0% 100%;
  --destructive:0 72% 51%;--destructive-foreground:0 0% 100%;
  --success:160 84% 39%;--success-foreground:0 0% 100%;
  --warning:32 95% 44%;--warning-foreground:0 0% 100%;
  --border:214 32% 89%;--input:214 32% 89%;--ring:217 91% 60%;
  --violet:262 83% 60%;
  --radius:0.8rem;
  --md-ref-typeface-brand:Roboto,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
  --md-ref-typeface-plain:Roboto,Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
  --md-sys-color-primary:hsl(var(--accent));
  --md-sys-color-on-primary:hsl(var(--accent-foreground));
  --md-sys-color-primary-container:hsl(var(--secondary));
  --md-sys-color-on-primary-container:hsl(var(--secondary-foreground));
  --md-sys-color-secondary:hsl(var(--primary));
  --md-sys-color-on-secondary:hsl(var(--primary-foreground));
  --md-sys-color-secondary-container:hsl(var(--secondary));
  --md-sys-color-on-secondary-container:hsl(var(--secondary-foreground));
  --md-sys-color-error:hsl(var(--destructive));
  --md-sys-color-on-error:hsl(var(--destructive-foreground));
  --md-sys-color-surface:hsl(var(--card));
  --md-sys-color-on-surface:hsl(var(--card-foreground));
  --md-sys-color-surface-container:hsl(var(--muted));
  --md-sys-color-surface-container-high:hsl(var(--card));
  --md-sys-color-surface-container-highest:hsl(var(--secondary));
  --md-sys-color-on-surface-variant:hsl(var(--muted-foreground));
  --md-sys-color-outline:hsl(var(--border));
  --md-sys-color-outline-variant:hsl(var(--border));
}
@media(prefers-color-scheme:dark){:root{
  color-scheme:dark;
  --background:222 47% 5%;--foreground:210 40% 96%;
  --card:222 40% 8%;--card-foreground:210 40% 96%;
  --primary:210 40% 96%;--primary-foreground:222 47% 11%;
  --secondary:217 33% 16%;--secondary-foreground:210 40% 96%;
  --muted:217 33% 15%;--muted-foreground:217 18% 62%;
  --accent:217 91% 62%;--accent-foreground:0 0% 100%;
  --destructive:0 72% 56%;--destructive-foreground:0 0% 100%;
  --success:160 70% 45%;--success-foreground:0 0% 100%;
  --warning:38 92% 55%;--warning-foreground:222 47% 11%;
  --border:217 33% 18%;--input:217 33% 18%;--ring:217 91% 62%;
  --violet:262 83% 66%;
}}
*{@apply border-border}
html{-webkit-text-size-adjust:100%}
body{@apply bg-background text-foreground min-h-screen antialiased;letter-spacing:-0.01em;background-image:radial-gradient(60rem 42rem at 82% -12%,hsl(var(--accent)/0.07),transparent 60%),radial-gradient(48rem 38rem at -8% -6%,hsl(var(--violet)/0.06),transparent 60%)}
::selection{background:hsl(var(--accent)/0.25)}
::-webkit-scrollbar{width:11px;height:11px}
::-webkit-scrollbar-thumb{background:hsl(var(--muted-foreground)/0.35);border-radius:9999px;border:3px solid transparent;background-clip:content-box}
::-webkit-scrollbar-thumb:hover{background:hsl(var(--muted-foreground)/0.55);background-clip:content-box}
button,input,a{font:inherit}
}
@layer components{
.header{@apply sticky top-0 z-50 flex items-center justify-between gap-4 px-6 py-3 border-b;background:hsl(var(--card)/0.72);backdrop-filter:saturate(180%) blur(18px);-webkit-backdrop-filter:saturate(180%) blur(18px)}
.header-main{@apply flex items-center gap-5 min-w-0}
.brand{@apply flex items-center gap-3 shrink-0}
.brand-mark{@apply relative grid place-items-center w-10 h-10 text-white overflow-hidden;isolation:isolate;border-radius:12px;background:radial-gradient(circle at 18% 16%,#7adc43 0%,#7adc43 18%,transparent 36%),radial-gradient(circle at 38% 26%,#ffe24a 0%,#ffe24a 18%,transparent 38%),radial-gradient(circle at 68% 22%,#ff4b4b 0%,#ff4b4b 20%,transparent 42%),radial-gradient(circle at 84% 82%,#00b8ff 0%,#00b8ff 24%,transparent 46%),linear-gradient(135deg,#ff9a28 0%,#f02f86 52%,#6e5cff 76%,#00c8f5 100%);box-shadow:0 10px 26px rgba(69,82,181,0.24),0 2px 8px rgba(255,89,84,0.18),inset 0 1px 0 rgba(255,255,255,0.35)}
.brand-mark::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 34% 16%,rgba(255,255,255,0.56),transparent 38%),linear-gradient(145deg,rgba(255,255,255,0.25),rgba(255,255,255,0) 58%);mix-blend-mode:screen}
.brand-mark::after{content:"";position:absolute;inset:1px;border:1px solid rgba(255,255,255,0.58);border-radius:11px;box-shadow:inset 0 1px 5px rgba(255,255,255,0.38),inset 0 -9px 18px rgba(255,255,255,0.12)}
.brand-emblem{position:relative;z-index:1;font-size:14px;font-weight:900;line-height:1;letter-spacing:0;color:#fff;background:linear-gradient(180deg,#fff 0%,#fff7e8 34%,#ffe6fb 66%,#dff2ff 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;-webkit-text-stroke:0.35px rgba(255,255,255,0.86);filter:drop-shadow(0 1px 0 rgba(255,255,255,0.68)) drop-shadow(0 6px 8px rgba(38,31,86,0.42));transform:translateY(-1px)}
.brand-copy{@apply flex flex-col gap-px leading-none}
.header h1{@apply text-base font-semibold whitespace-nowrap;letter-spacing:0}
.subtitle{@apply text-xs text-muted-foreground max-w-[220px] truncate}
.breadcrumb{@apply flex items-center flex-wrap gap-1 min-w-0}
.breadcrumb-item{@apply inline-flex items-center gap-1 text-[13px] text-muted-foreground no-underline px-2 py-1 rounded-md transition-colors}
.breadcrumb-item:hover{@apply text-foreground bg-secondary}
.breadcrumb-sep{@apply text-muted-foreground/50 text-xs}
.header-stats{@apply flex items-center gap-2 flex-wrap justify-end}
.stat-pill{@apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs text-muted-foreground whitespace-nowrap;background:hsl(var(--card)/0.5)}
.stat-pill b{@apply text-foreground font-semibold}
.container{@apply relative max-w-[1240px] mx-auto p-6}
.toolbar{@apply flex gap-2 mb-4 flex-wrap items-center p-2 rounded-xl border;background:hsl(var(--card)/0.6);backdrop-filter:saturate(160%) blur(14px);-webkit-backdrop-filter:saturate(160%) blur(14px);box-shadow:0 1px 2px hsl(222 47% 11%/0.05)}
md-filled-button,md-filled-tonal-button,md-outlined-button,md-text-button{--md-filled-button-container-shape:10px;--md-filled-tonal-button-container-shape:10px;--md-outlined-button-container-shape:10px;--md-text-button-container-shape:10px;--md-filled-button-label-text-size:13px;--md-filled-tonal-button-label-text-size:13px;--md-outlined-button-label-text-size:13px;--md-text-button-label-text-size:13px;--md-filled-button-label-text-weight:600;--md-filled-tonal-button-label-text-weight:600;--md-outlined-button-label-text-weight:600;--md-text-button-label-text-weight:600}
.toolbar md-filled-button,.toolbar md-filled-tonal-button,.toolbar md-outlined-button,#toolbarPaste md-filled-button{height:38px}
md-filled-button .lucide,md-filled-tonal-button .lucide,md-outlined-button .lucide,md-text-button .lucide{width:16px;height:16px;stroke-width:1.9}
.material-icon-button{width:32px;height:32px;color:hsl(var(--muted-foreground));--md-icon-button-icon-size:16px;--md-icon-button-state-layer-width:32px;--md-icon-button-state-layer-height:32px}
.material-icon-button:hover{color:hsl(var(--foreground))}
.material-icon-button.danger{color:hsl(var(--destructive))}
.material-icon-button .lucide{width:16px;height:16px;stroke-width:1.9}
md-checkbox{--md-checkbox-container-shape:4px;--md-checkbox-outline-color:hsl(var(--muted-foreground));--md-checkbox-selected-container-color:hsl(var(--accent));--md-checkbox-selected-icon-color:hsl(var(--accent-foreground))}
.btn{@apply inline-flex items-center justify-center gap-2 min-h-[38px] px-3.5 text-[13px] font-medium rounded-lg border bg-card text-foreground cursor-pointer no-underline whitespace-nowrap transition-all duration-150;box-shadow:0 1px 2px hsl(222 47% 11%/0.05)}
.btn:hover{@apply bg-secondary -translate-y-px}
.btn:active{@apply translate-y-0}
.btn:focus-visible,.group-toggle:focus-visible,.breadcrumb-item:focus-visible,input:focus-visible,md-filled-button:focus-visible,md-filled-tonal-button:focus-visible,md-outlined-button:focus-visible,md-text-button:focus-visible,md-icon-button:focus-visible,md-checkbox:focus-visible,md-outlined-text-field:focus-visible{@apply outline-none;--tw-ring-offset-color:hsl(var(--background))}
.btn-primary{@apply bg-primary text-primary-foreground border-transparent;box-shadow:0 6px 18px hsl(var(--primary)/0.22)}
.btn-primary:hover{@apply bg-primary/90 text-primary-foreground}
.btn-danger{@apply text-destructive;border-color:hsl(var(--destructive)/0.4)}
.btn-danger:hover{@apply text-destructive;background:hsl(var(--destructive)/0.1);border-color:hsl(var(--destructive)/0.6)}
.btn-sm{@apply min-h-[30px] px-2.5 text-xs rounded-md}
.msg{@apply px-3.5 py-3 rounded-lg mb-4 text-[13px] border}
.msg.success{color:hsl(var(--success));background:hsl(var(--success)/0.1);border-color:hsl(var(--success)/0.3)}
.msg.error{color:hsl(var(--destructive));background:hsl(var(--destructive)/0.1);border-color:hsl(var(--destructive)/0.3)}
.table-wrap{@apply rounded-xl border overflow-hidden;background:hsl(var(--card)/0.7);backdrop-filter:saturate(160%) blur(14px);-webkit-backdrop-filter:saturate(160%) blur(14px);box-shadow:0 12px 40px hsl(222 47% 11%/0.07)}
table{@apply w-full;border-collapse:separate;border-spacing:0}
th{@apply border-b px-3.5 py-3 text-left font-semibold text-xs text-muted-foreground;background:hsl(var(--card)/0.4)}
td{@apply px-3.5 py-2.5 text-[13px] align-middle border-b;border-color:hsl(var(--border)/0.6)}
tr:last-child td{@apply border-b-0}
.file-row{@apply transition-colors}
.file-row:hover{@apply bg-secondary/60}
.file-icon{@apply text-lg w-10 text-center}
.file-name a{@apply text-foreground no-underline break-words font-medium transition-colors}
.file-name a:hover{@apply text-accent}
.file-size,.file-time{@apply text-muted-foreground text-xs whitespace-nowrap}
.file-actions{@apply flex gap-1.5 whitespace-nowrap justify-end}
.empty{@apply text-center py-16 px-5 text-muted-foreground text-[15px]}
.lucide{width:16px;height:16px;stroke-width:1.75;flex-shrink:0;display:inline-block;vertical-align:-0.14em}
.col-icon .lucide,.file-icon .lucide{width:18px;height:18px}
.btn-sm .lucide{width:15px;height:15px}
.preview-close .lucide{width:20px;height:20px}
.sort-icon{display:inline-flex;align-items:center}
.sort-icon .lucide{width:13px;height:13px}
.empty .lucide{width:42px;height:42px;display:block;margin:0 auto 12px;opacity:.55;stroke-width:1.4}
.fic{color:hsl(var(--muted-foreground))}
.fic-blue{color:hsl(var(--accent))}
.fic-green{color:hsl(158 64% 42%)}
.fic-violet{color:hsl(var(--violet))}
.fic-amber{color:hsl(38 92% 50%)}
.fic-rose{color:hsl(345 80% 58%)}
.fic-cyan{color:hsl(190 85% 45%)}
.material-dialog{width:min(520px,calc(100vw - 32px));--md-dialog-container-color:hsl(var(--card));--md-dialog-container-shape:18px;--md-dialog-headline-color:hsl(var(--foreground));--md-dialog-supporting-text-color:hsl(var(--muted-foreground))}
#uploadModal{width:min(560px,calc(100vw - 32px))}
.dialog-headline{@apply flex items-center gap-2 text-lg font-semibold}
.dialog-headline .lucide{width:18px;height:18px;color:hsl(var(--accent))}
.dialog-content{@apply flex flex-col gap-4}
.dialog-support{@apply text-[13px] text-muted-foreground break-all}
.modal-actions{@apply flex gap-2 justify-end}
md-outlined-text-field{width:100%;--md-outlined-text-field-container-shape:10px;--md-outlined-text-field-focus-outline-color:hsl(var(--accent));--md-outlined-text-field-input-text-color:hsl(var(--foreground));--md-outlined-text-field-label-text-color:hsl(var(--muted-foreground));--md-outlined-text-field-focus-label-text-color:hsl(var(--accent))}
.upload-area{@apply rounded-xl p-10 text-center cursor-pointer mb-4 transition-all;border:1.5px dashed hsl(var(--border));background:hsl(var(--secondary)/0.4)}
.upload-area:hover,.upload-area.dragover{border-color:hsl(var(--accent));background:hsl(var(--accent)/0.08)}
.upload-area.dragover{@apply scale-[1.01]}
.upload-area p{@apply text-foreground mt-2 text-sm font-medium}
.upload-area .icon .lucide{width:46px;height:46px;stroke-width:1.4;color:hsl(var(--accent))}
.drop-zone-hint{@apply text-xs text-muted-foreground mt-1}
#uploadProgress{@apply flex flex-col gap-2}
#progressBar{--md-linear-progress-track-height:8px;--md-linear-progress-active-indicator-height:8px;--md-linear-progress-track-shape:8px;--md-linear-progress-track-color:hsl(var(--secondary));--md-linear-progress-active-indicator-color:hsl(var(--accent))}
#progressText{@apply text-muted-foreground !important}
.preview-overlay{@apply fixed inset-0 z-[300] flex justify-center items-center flex-col p-6 invisible opacity-0 transition-opacity duration-200;background:hsl(222 47% 2%/0.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);pointer-events:none}
.preview-overlay.show{@apply visible opacity-100;pointer-events:auto}
.preview-overlay img,.preview-overlay video,.preview-overlay audio{@apply rounded-xl;max-width:min(92vw,1200px);max-height:80vh;box-shadow:0 24px 80px rgba(0,0,0,0.5)}
.preview-overlay pre{@apply rounded-xl p-5 overflow-auto text-[13px] leading-relaxed;background:#0b1020;color:#dbeafe;border:1px solid rgba(148,163,184,0.18);max-width:min(92vw,1100px);max-height:80vh;white-space:pre-wrap;word-break:break-word;box-shadow:0 24px 80px rgba(0,0,0,0.4)}
.preview-close{@apply absolute top-5 right-6 text-white text-2xl cursor-pointer rounded-lg z-[301] w-11 h-11 grid place-items-center transition-colors;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.16)}
.preview-close:hover{background:rgba(255,255,255,0.18)}
.preview-name{@apply text-white/90 mt-3 text-sm max-w-[90vw] truncate}
.fb-item{@apply flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer transition-colors border-b text-sm}
.fb-item:last-child{@apply border-b-0}
.fb-item:hover{@apply bg-secondary}
.fb-icon{@apply text-base shrink-0}
.clipboard-bar{@apply flex items-center gap-3 px-3 py-2.5 rounded-lg mb-4 text-[13px] flex-wrap border}
.clipboard-bar.move{color:hsl(var(--warning));background:hsl(var(--warning)/0.12);border-color:hsl(var(--warning)/0.3)}
.clipboard-bar.copy{color:hsl(var(--accent));background:hsl(var(--accent)/0.1);border-color:hsl(var(--accent)/0.3)}
.toast{@apply fixed top-5 left-1/2 px-4 py-3 rounded-lg text-[13px] z-[999] opacity-0 pointer-events-none font-medium transition-all duration-300;transform:translateX(-50%) translateY(-8px);box-shadow:0 14px 44px hsl(222 47% 4%/0.3)}
.toast.show{@apply opacity-100;transform:translateX(-50%) translateY(0)}
.toast.success{@apply text-white;background:hsl(var(--success))}
.toast.info{@apply text-white;background:hsl(var(--accent))}
.col-check{@apply w-9 text-center}
.col-check md-checkbox{width:28px;height:28px;vertical-align:middle}
.sortable{@apply cursor-pointer select-none transition-colors relative}
.sortable:hover{@apply bg-secondary/60}
.sortable a{@apply text-muted-foreground no-underline inline-flex items-center gap-1}
.sortable a:hover{@apply text-foreground}
.sortable .sort-icon{@apply text-[10px];color:hsl(var(--accent))}
.sortable:not(.sort-active) .sort-icon{@apply opacity-30}
.group-toggle{@apply no-underline}
tr.selected{background:hsl(var(--accent)/0.1)!important}
.batch-bar{@apply flex items-center gap-2 px-3 py-2.5 rounded-lg mb-4 text-[13px] flex-wrap text-white;background:linear-gradient(135deg,hsl(var(--accent)),hsl(var(--violet)));box-shadow:0 10px 28px hsl(var(--accent)/0.32)}
.batch-bar b{@apply text-sm}
.batch-bar .btn{@apply text-white;background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.3)}
.batch-bar .btn:hover{@apply text-white;background:rgba(255,255,255,0.22);border-color:rgba(255,255,255,0.55)}
.batch-bar .btn-danger{border-color:rgba(255,255,255,0.4)}
.batch-bar .btn-danger:hover{background:rgba(220,38,38,0.4)}
.batch-bar md-filled-tonal-button,.batch-bar md-outlined-button{height:32px;--md-filled-tonal-button-container-color:rgba(255,255,255,0.14);--md-filled-tonal-button-label-text-color:#fff;--md-outlined-button-label-text-color:#fff;--md-outlined-button-outline-color:rgba(255,255,255,0.4)}
.batch-bar md-filled-tonal-button:hover,.batch-bar md-outlined-button:hover{--md-filled-tonal-button-container-color:rgba(255,255,255,0.22);--md-outlined-button-outline-color:rgba(255,255,255,0.65)}
}
@media(max-width:860px){
  .header{@apply flex-col items-start px-4 py-3 gap-2.5}
  .header-main{@apply flex-col items-start gap-2.5 w-full}
  .brand{@apply w-full}
  .subtitle{max-width:70vw}
  .header-stats{@apply justify-start}
  .stat-pill{@apply text-[11px] px-2 py-1}
  .breadcrumb,.breadcrumb-item{@apply text-xs}
  .container{@apply p-3.5}
  .toolbar{@apply gap-1.5 p-1.5}
  .toolbar md-filled-button,.toolbar md-filled-tonal-button,.toolbar md-outlined-button,#toolbarPaste md-filled-button{height:34px}
  table{table-layout:fixed}
  th,td{@apply px-1.5 py-2 text-xs}
  .col-size,.col-time{@apply hidden}
  .col-icon{@apply w-8}
  .col-name{@apply overflow-hidden text-ellipsis}
  .col-actions{width:auto}
  .col-check{@apply w-7}
  .col-check md-checkbox{width:26px;height:26px}
  .file-name a{@apply text-[13px]}
  .file-actions{@apply gap-1 flex-wrap justify-start}
  .file-actions .btn-sm{@apply px-1.5 py-1 text-xs}
  .material-dialog{width:calc(100vw - 24px)}
  .upload-area{@apply p-8}
  .clipboard-bar{@apply px-2.5 py-2 text-xs gap-2}
  .clipboard-bar .hide-mobile{@apply hidden}
  .toast{@apply text-xs px-3.5 py-2.5 max-w-[90%]}
}
</style>
</head>
<body>
<div id="toast" class="toast"></div>
<div class="header">
  <div class="header-main">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true"><span class="brand-emblem">FM</span></div>
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
    <md-filled-button type="button" onclick="showUpload()"><i data-lucide="upload" slot="icon"></i>上传文件</md-filled-button>
    <md-outlined-button type="button" onclick="showNewFolder()"><i data-lucide="folder-plus" slot="icon"></i>新建文件夹</md-outlined-button>
    <md-outlined-button type="button" onclick="location.reload()"><i data-lucide="refresh-cw" slot="icon"></i>刷新</md-outlined-button>
    <${groupDirs?'md-filled-tonal-button':'md-outlined-button'} href="?sort=${sortField}&dir=${sortDir}&group=${groupDirs?0:1}" class="group-toggle" title="切换目录优先显示"><i data-lucide="folder-tree" slot="icon"></i>目录优先</${groupDirs?'md-filled-tonal-button':'md-outlined-button'}>
    <span id="toolbarPaste"></span>
  </div>
  <div id="batchBar"></div>
  <div id="clipboardBar"></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th class="col-check" style="width:36px"><md-checkbox touch-target="wrapper" id="selectAll" aria-label="选择全部"></md-checkbox></th><th class="col-icon" style="width:40px"></th><th class="col-name sortable${sortClass('name')}"><a href="${sortUrl('name')}">名称${sortIcon('name')}</a></th><th class="col-size sortable${sortClass('size')}" style="width:80px"><a href="${sortUrl('size')}">大小${sortIcon('size')}</a></th><th class="col-time sortable${sortClass('mtime')}" style="width:160px"><a href="${sortUrl('mtime')}">修改时间${sortIcon('mtime')}</a></th><th class="col-actions" style="width:220px">操作</th></tr></thead>
      <tbody>
        ${rp !== '/' ? '<tr class="file-row"><td class="col-check"></td><td class="col-icon"><i data-lucide="corner-left-up" class="fic"></i></td><td class="col-name"><a href="../">返回上级</a></td><td class="col-size">-</td><td class="col-time">-</td><td class="col-actions"></td></tr>' : ''}
        ${listHtml}
      </tbody>
    </table>
    ${emptyHtml}
  </div>
</div>

<!-- Upload Dialog -->
<md-dialog id="uploadModal" class="material-dialog">
  <div slot="headline" class="dialog-headline"><i data-lucide="upload"></i><span>上传文件</span></div>
  <div slot="content" class="dialog-content">
    <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()">
      <div class="icon"><i data-lucide="cloud-upload"></i></div>
      <p>点击选择文件，或拖拽文件到这里</p>
      <div class="drop-zone-hint">支持多文件上传</div>
    </div>
    <input type="file" id="fileInput" multiple style="display:none">
    <div id="uploadProgress" style="display:none">
      <md-linear-progress id="progressBar" value="0" aria-label="上传进度"></md-linear-progress>
      <div id="progressText" style="font-size:13px;color:#999;text-align:center"></div>
    </div>
  </div>
  <div slot="actions" class="modal-actions">
    <md-text-button type="button" onclick="closeModal('uploadModal')">取消</md-text-button>
  </div>
</md-dialog>

<!-- New Folder Dialog -->
<md-dialog id="folderModal" class="material-dialog">
  <div slot="headline" class="dialog-headline"><i data-lucide="folder-plus"></i><span>新建文件夹</span></div>
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
  <div slot="headline" class="dialog-headline"><i data-lucide="pencil"></i><span>重命名</span></div>
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
  <md-icon-button class="preview-close" onclick="closePreview()" aria-label="关闭预览"><i data-lucide="x"></i></md-icon-button>
  <div id="previewContent"></div>
  <div class="preview-name" id="previewName"></div>
</div>

<script>
const currentPath = location.pathname;
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function refreshIcons(){if(window.lucide)lucide.createIcons();}

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
    '<md-filled-tonal-button type="button" class="act-btn" data-act="batch-download"><i data-lucide="download" slot="icon"></i>打包下载</md-filled-tonal-button>'+
    '<md-filled-tonal-button type="button" class="act-btn" data-act="batch-copy"><i data-lucide="copy" slot="icon"></i>批量复制</md-filled-tonal-button>'+
    '<md-filled-tonal-button type="button" class="act-btn" data-act="batch-move"><i data-lucide="scissors" slot="icon"></i>批量移动</md-filled-tonal-button>'+
    '<md-outlined-button type="button" class="act-btn" data-act="batch-delete"><i data-lucide="trash-2" slot="icon"></i>批量删除</md-outlined-button>'+
    '<md-outlined-button type="button" class="act-btn" data-act="batch-clear" style="margin-left:auto"><i data-lucide="x" slot="icon"></i>取消选择</md-outlined-button>'+
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
    bar.value = totalSize ? uploadedSize/totalSize : i/files.length;
    try{
      await uploadFile(file, function(loaded, total){
        var pct = totalSize ? Math.round((uploadedSize + loaded) / totalSize * 100) : Math.round(idx/files.length*100);
        bar.value = pct / 100;
        text.textContent = '上传 ' + idx + '/' + files.length + '  ' + file.name + '  ' + formatSize(loaded) + '/' + formatSize(total);
      });
      uploadedSize += file.size;
      if(!totalSize) bar.value = idx/files.length;
    }catch(e){
      text.textContent = '上传失败: ' + file.name + (e.message ? ' (' + e.message + ')' : '');
      return;
    }
  }
  bar.value = 1;
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
  var icon = isMove ? '<i data-lucide="scissors"></i>' : '<i data-lucide="copy"></i>';
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
  cancelBtn.style.cssText = 'margin-left:auto;opacity:0.7';
  cancelBtn.innerHTML = '<i data-lucide="x" slot="icon"></i>取消';
  bar.querySelector('.clipboard-bar').appendChild(cancelBtn);
  // Paste button in toolbar
  toolbar.innerHTML = '';
  var pasteBtn = document.createElement('md-filled-button');
  pasteBtn.className = 'act-btn';
  pasteBtn.setAttribute('type', 'button');
  pasteBtn.setAttribute('data-act', 'paste');
  pasteBtn.innerHTML = '<i data-lucide="clipboard-paste" slot="icon"></i>粘贴到此处';
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
// Initialize clipboard bar on page load
window.addEventListener('load', function(){
  try{ renderClipboard(); }catch(e){ console.error('renderClipboard error:', e); }
  refreshIcons();
});
// Also try immediately
try{ renderClipboard(); }catch(e){}
refreshIcons();
</script>
</body>
</html>`;
}

module.exports = { getHTML };
