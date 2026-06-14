const { esc, formatSize, itemHref } = require('./utils');
const { getIcon, PREVIEW } = require('./file-ops');
const { assetVersion } = require('./handlers/static');
const { isAuthActive } = require('./auth');
const { version } = require('../package.json');

const PREVIEWABLE = new Set([].concat(PREVIEW.image, PREVIEW.video, PREVIEW.audio, PREVIEW.text));
const IMAGE_EXTS = new Set(PREVIEW.image);
const THUMB_EXTS = new Set([].concat(PREVIEW.image, PREVIEW.video));
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23C96442' d='M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z'/%3E%3C/svg%3E";

function getHTML(list, rp, sortField, sortDir, groupDirs) {
  sortField = sortField || 'name';
  sortDir = sortDir || 'asc';
  groupDirs = groupDirs !== false;
  const AUTH_ENABLED = isAuthActive();

  // 非默认排序时，目录链接携带排序参数，导航后保持排序状态
  const qp = [];
  if (sortField !== 'name' || sortDir !== 'asc') qp.push('sort=' + sortField, 'dir=' + sortDir);
  if (!groupDirs) qp.push('group=0');
  const qs = qp.length ? '?' + qp.join('&') : '';

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
  let breadcrumbHtml = '<a href="/' + qs + '" class="breadcrumb-item"><md-icon>home</md-icon> 根目录</a>';
  const cumParts = [];
  for (const b of breadcrumbs) {
    cumParts.push(b);
    const href = '/' + cumParts.map(encodeURIComponent).join('/') + '/' + qs;
    breadcrumbHtml += '<span class="breadcrumb-sep">/</span><a href="' + href + '" class="breadcrumb-item">' + esc(b) + '</a>';
  }

  const dirCount = list.filter(i => i.isDir).length;
  const fileCount = list.length - dirCount;
  const currentLabel = breadcrumbs.length ? breadcrumbs[breadcrumbs.length - 1] : '根目录';
  const statsHtml = '<div class="header-stats">' +
    '<span class="stat-pill"><b>' + dirCount + '</b> 文件夹</span>' +
    '<span class="stat-pill"><b>' + fileCount + '</b> 文件</span>' +
    '<span class="stat-pill" id="dirSizePill"><md-icon style="font-size:14px;vertical-align:middle">hourglass_empty</md-icon> 计算中…</span>' +
    '</div>';

  const listHtml = list.map(i => {
    const href = itemHref(i.name, i.isDir) + (i.isDir ? qs : '');
    const icon = getIcon(i.name, i.isDir);
    const size = i.isDir ? '-' : formatSize(i.size);
    const mtimeMs = i.mtime ? new Date(i.mtime).getTime() : '';
    const encodedName = encodeURIComponent(i.name);
    const dot = i.name.lastIndexOf('.');
    const ext = dot >= 0 ? i.name.slice(dot + 1).toLowerCase() : '';
    const canPreview = !i.isDir && PREVIEWABLE.has(ext);
    const isImage = !i.isDir && THUMB_EXTS.has(ext);
    const thumb = isImage ? '<img class="thumb" loading="lazy" alt="" src="' + encodedName + '?thumb=1" onload="this.classList.add(\'loaded\')" onerror="this.style.display=\'none\'">' : '';
    const dn = esc(i.name);
    const dlBtn = i.isDir ? '' : '<md-icon-button href="' + encodedName + '?download=1" class="material-icon-button" aria-label="下载" title="下载"><md-icon>download</md-icon></md-icon-button>';
    const previewBtn = canPreview ? '<md-icon-button type="button" class="material-icon-button act-btn" data-act="preview" data-name="' + dn + '" aria-label="预览" title="预览"><md-icon>visibility</md-icon></md-icon-button>' : '';
    const shareBtn = i.isDir ? '' : '<md-icon-button type="button" class="material-icon-button act-btn" data-act="share" data-name="' + dn + '" aria-label="分享直链" title="分享直链"><md-icon>share</md-icon></md-icon-button>';
    return '<tr class="file-row" data-name="' + dn + '">' +
      '<td class="col-check"><md-checkbox touch-target="wrapper" class="row-cb" data-name="' + dn + '"' + (i.isDir ? ' data-dir="1"' : '') + ' aria-label="选择 ' + dn + '"></md-checkbox></td>' +
      '<td class="col-icon file-icon">' + thumb + icon + '</td>' +
      '<td class="col-name file-name"><a href="' + href + '">' + dn + '</a></td>' +
      '<td class="col-size file-size">' + size + '</td>' +
      '<td class="col-time file-time" data-mtime="' + mtimeMs + '">-</td>' +
      '<td class="col-actions file-actions">' + previewBtn + dlBtn + shareBtn +
        '<md-icon-button type="button" class="material-icon-button act-btn" data-act="rename" data-name="' + dn + '" aria-label="重命名" title="重命名"><md-icon>edit</md-icon></md-icon-button>' +
        '<md-icon-button type="button" class="material-icon-button act-btn" data-act="move" data-name="' + dn + '" aria-label="移动" title="移动"><md-icon>content_cut</md-icon></md-icon-button>' +
        '<md-icon-button type="button" class="material-icon-button act-btn" data-act="copy" data-name="' + dn + '" aria-label="复制" title="复制"><md-icon>content_copy</md-icon></md-icon-button>' +
        '<md-icon-button type="button" class="material-icon-button danger act-btn" data-act="delete" data-name="' + dn + '" aria-label="删除" title="删除"><md-icon>delete</md-icon></md-icon-button>' +
        '<md-icon-button type="button" class="more-btn act-btn" data-act="menu" data-name="' + dn + '"' + (i.isDir ? ' data-dir="1"' : '') + (canPreview ? ' data-preview="1"' : '') + ' aria-label="更多操作"><md-icon>more_vert</md-icon></md-icon-button>' +
      '</td></tr>';
  }).join('');

  const emptyHtml = list.length === 0 ? '<div class="empty"><md-icon>folder_open</md-icon>空目录，上传文件或新建文件夹开始使用</div>' : '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#EAE8DE" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#30302E" media="(prefers-color-scheme: dark)">
<title>${esc(currentLabel)} - winFM</title>
<link rel="icon" href="${FAVICON}">
<script>try{var t=localStorage.getItem('fm_theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}</script>
<script>try{if(localStorage.getItem('fm_view')==='grid')document.documentElement.dataset.view='grid'}catch(e){}</script>
<script>window.__FM=${JSON.stringify({ preview: PREVIEW, auth: AUTH_ENABLED })}</script>
<link rel="stylesheet" href="/__fm/app.css?v=${assetVersion('app.css')}">
<script type="module" src="/__fm/material-web.js?v=${assetVersion('material-web.js')}"></script>
<script src="/__fm/app.js?v=${assetVersion('app.js')}" defer></script>
</head>
<body>
<div id="toast" class="toast"></div>
<div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar(false)"></div>
<div class="app-bar">
  <md-icon-button class="sidebar-toggle-mobile" onclick="toggleSidebar()" aria-label="切换侧栏"><md-icon>menu</md-icon></md-icon-button>
  <md-icon-button class="sidebar-toggle-desktop" onclick="toggleSidebarCollapse()" aria-label="切换侧栏" title="切换侧栏"><md-icon>menu</md-icon></md-icon-button>
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
  <md-icon-button class="theme-toggle" onclick="toggleTheme()" aria-label="切换深浅色" title="切换深浅色"><md-icon id="themeIcon">dark_mode</md-icon></md-icon-button>
  ${AUTH_ENABLED ? '<md-icon-button class="theme-toggle" onclick="logout()" aria-label="退出登录" title="退出登录"><md-icon>logout</md-icon></md-icon-button>' : ''}
  ${statsHtml}
</div>
<div class="app-layout">
<aside class="sidebar" id="sidebar">
  <div class="sidebar-inner">
    <div class="sidebar-header">
      <div class="sidebar-header-icon"><md-icon>folder_open</md-icon></div>
      <div class="sidebar-header-text">文件管理</div>
      <md-icon-button class="sidebar-collapse" onclick="toggleSidebarCollapse()" aria-label="收起侧栏" title="收起侧栏"><md-icon>chevron_left</md-icon></md-icon-button>
    </div>
    <div class="sidebar-section">
      <div class="sidebar-title"><md-icon>bookmark</md-icon> 常用目录</div>
      <div class="bookmark-list" id="bookmarkList"></div>
      <div class="bookmark-add" onclick="addBookmark()" title="将当前目录添加到常用"><md-icon>add</md-icon>添加当前目录</div>
    </div>
    <div class="sidebar-divider"></div>
    <div class="sidebar-section sidebar-tree-section">
      <div class="sidebar-title"><md-icon>account_tree</md-icon> 目录结构</div>
      <div class="tree-container" id="dirTree"></div>
    </div>
  </div>
  <div class="sidebar-footer">
    <a class="sidebar-footer-link" href="https://github.com/lageev/winFM" target="_blank" rel="noopener noreferrer" title="GitHub">
      <svg class="sidebar-footer-github" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
    </a>
    <div class="sidebar-footer-version">winFM v${version}</div>
  </div>
</aside>
<main class="main-content">
<div class="container">
  <div class="toolbar">
    <md-filled-button type="button" onclick="showUpload()"><md-icon slot="icon">upload</md-icon>上传文件</md-filled-button>
    <md-filled-button type="button" onclick="showFolderUpload()"><md-icon slot="icon">drive_folder_upload</md-icon>上传文件夹</md-filled-button>
    <md-filled-tonal-button type="button" onclick="showNewFolder()"><md-icon slot="icon">create_new_folder</md-icon>新建文件夹</md-filled-tonal-button>
    <md-outlined-button type="button" onclick="refreshList()"><md-icon slot="icon">refresh</md-icon>刷新</md-outlined-button>
    <${groupDirs?'md-filled-tonal-button':'md-outlined-button'} href="?sort=${sortField}&dir=${sortDir}&group=${groupDirs?0:1}" class="group-toggle" title="切换目录优先显示"><md-icon slot="icon">account_tree</md-icon>目录优先</${groupDirs?'md-filled-tonal-button':'md-outlined-button'}>
    <md-outlined-button type="button" onclick="toggleView()" title="切换缩略图/列表显示"><md-icon slot="icon" id="viewToggleIcon">grid_view</md-icon><span id="viewToggleLabel">缩略图</span></md-outlined-button>
    <span id="toolbarPaste"></span>
    <div class="filter-box"><md-icon>search</md-icon><input id="filterInput" type="text" placeholder="过滤当前目录" oninput="applyFilter()"></div>
  </div>
  <div id="batchBar"></div>
  <div id="clipboardBar"></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th class="col-check"><md-checkbox touch-target="wrapper" id="selectAll" aria-label="选择全部"></md-checkbox></th><th class="col-icon"></th><th class="col-name sortable${sortClass('name')}"><a href="${sortUrl('name')}">名称${sortIcon('name')}</a></th><th class="col-size sortable${sortClass('size')}" style="width:90px"><a href="${sortUrl('size')}">大小${sortIcon('size')}</a></th><th class="col-time sortable${sortClass('mtime')}" style="width:170px"><a href="${sortUrl('mtime')}">修改时间${sortIcon('mtime')}</a></th><th class="col-actions" style="width:260px">操作</th></tr></thead>
      <tbody>
        ${rp !== '/' ? '<tr class="file-row"><td class="col-check"></td><td class="col-icon file-icon"><md-icon class="fic">drive_folder_upload</md-icon></td><td class="col-name file-name"><a href="../' + qs + '">返回上级</a></td><td class="col-size">-</td><td class="col-time">-</td><td class="col-actions"></td></tr>' : ''}
        ${listHtml}
      </tbody>
    </table>
    ${emptyHtml}
  </div>
</div>
</main>
</div>

<!-- Upload Dialog -->
<md-dialog id="uploadModal" class="material-dialog">
  <div slot="headline" class="dialog-headline"><md-icon>upload</md-icon><span>上传文件</span></div>
  <div slot="content" class="dialog-content">
    <div class="upload-area" id="uploadArea" onclick="document.getElementById('fileInput').click()">
      <div class="icon"><md-icon>cloud_upload</md-icon></div>
      <p>点击选择文件，或拖拽文件到这里</p>
      <div class="drop-zone-hint">支持多文件、文件夹上传及拖放</div>
    </div>
    <input type="file" id="fileInput" multiple style="display:none">
    <input type="file" id="folderInput" webkitdirectory style="display:none">
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

<!-- Share Dialog -->
<md-dialog id="shareModal" class="material-dialog">
  <div slot="headline" class="dialog-headline"><md-icon>share</md-icon><span>分享直链</span></div>
  <div slot="content" class="dialog-content">
    <div id="shareFileName" class="dialog-support"></div>
    <div id="shareOptions" class="share-options">
      <md-outlined-text-field id="shareMaxViews" class="share-option-field" type="number" min="0" value="0" label="查看次数" suffix-text="0=不限" no-spinner></md-outlined-text-field>
      <md-outlined-text-field id="shareExpireHours" class="share-option-field" type="number" min="0" value="24" label="有效期(小时)" suffix-text="0=永久" no-spinner></md-outlined-text-field>
    </div>
    <md-outlined-text-field id="shareLinkField" label="链接地址" readonly></md-outlined-text-field>
    <div class="dialog-support">${!AUTH_ENABLED ? '任何能访问本服务的人都可通过该链接直接打开此文件。' : '凭此链接无需登录即可查看本文件，受上面设置的查看次数与有效期限制。'}</div>
  </div>
  <div slot="actions" class="modal-actions">
    <md-text-button type="button" onclick="closeModal('shareModal')">关闭</md-text-button>
    <md-filled-tonal-button type="button" id="shareGenBtn" onclick="generateShareLink()"><md-icon slot="icon">link</md-icon>生成链接</md-filled-tonal-button>
    <md-outlined-button type="button" id="shareOpenBtn" onclick="openShareLink()"><md-icon slot="icon">open_in_new</md-icon>打开</md-outlined-button>
    <md-filled-button type="button" id="shareCopyBtn" onclick="copyShareLink()"><md-icon slot="icon">content_copy</md-icon><span class="btn-label">复制链接</span></md-filled-button>
  </div>
</md-dialog>

<!-- Confirm Dialog -->
<md-dialog id="confirmModal" class="material-dialog">
  <div slot="headline" class="dialog-headline danger"><md-icon>delete</md-icon><span>确认操作</span></div>
  <div slot="content" class="dialog-content">
    <div id="confirmText" class="dialog-support"></div>
  </div>
  <div slot="actions" class="modal-actions">
    <md-text-button type="button" id="confirmCancel">取消</md-text-button>
    <md-filled-button type="button" id="confirmOk">确定</md-filled-button>
  </div>
</md-dialog>

<!-- Row Actions Menu (mobile) -->
<md-menu id="rowMenu" positioning="fixed" quick></md-menu>

<!-- Preview Modal -->
<div class="preview-overlay" id="previewOverlay">
  <md-icon-button class="preview-close" onclick="closePreview()" aria-label="关闭预览"><md-icon>close</md-icon></md-icon-button>
  <md-icon-button class="preview-nav prev hidden" id="previewPrev" onclick="previewStep(-1)" aria-label="上一个"><md-icon>navigate_before</md-icon></md-icon-button>
  <md-icon-button class="preview-nav next hidden" id="previewNext" onclick="previewStep(1)" aria-label="下一个"><md-icon>navigate_next</md-icon></md-icon-button>
  <div id="previewContent"></div>
  <div class="preview-name" id="previewName"></div>
</div>

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
