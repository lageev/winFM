var currentPath = location.pathname;
var PV = (window.__FM && window.__FM.preview) || { image: [], video: [], audio: [], text: [] };

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function extOf(name){var dot=name.lastIndexOf('.');return dot>=0?name.slice(dot+1).toLowerCase():''}

function formatSize(bytes){
  if(bytes===0) return '0 B';
  var k=1024,sizes=['B','KB','MB','GB','TB'];
  var i=Math.min(Math.floor(Math.log(bytes)/Math.log(k)),sizes.length-1);
  return parseFloat((bytes/Math.pow(k,i)).toFixed(1))+' '+sizes[i];
}

// ── Dialogs ──
function showDialog(id){
  var dialog=document.getElementById(id);
  if(!dialog||dialog.open) return;
  if(typeof dialog.show==='function') dialog.show();
  else dialog.setAttribute('open','');
}
function closeModal(id){
  var dialog=document.getElementById(id);
  if(!dialog) return;
  if(typeof dialog.close==='function'&&dialog.open) dialog.close();
  else dialog.removeAttribute('open');
}
function showUpload(){showDialog('uploadModal')}
function showFolderUpload(){document.getElementById('folderInput').click()}
function showNewFolder(){
  showDialog('folderModal');
  setTimeout(function(){document.getElementById('folderName').focus()},100);
}

// Material 风格确认框，替代原生 confirm()
function confirmDialog(text){
  return new Promise(function(resolve){
    var dlg=document.getElementById('confirmModal');
    if(!dlg||typeof dlg.show!=='function'){resolve(window.confirm(text));return}
    document.getElementById('confirmText').textContent=text;
    var done=false;
    function finish(val){if(done)return;done=true;resolve(val)}
    document.getElementById('confirmOk').onclick=function(){finish(true);dlg.close()};
    document.getElementById('confirmCancel').onclick=function(){dlg.close()};
    dlg.addEventListener('closed',function h(){dlg.removeEventListener('closed',h);finish(false)});
    dlg.show();
  });
}

// ── Toast ──
function showToast(msg,type){
  var t=document.getElementById('toast');
  t.textContent=msg;
  t.className='toast '+(type||'info')+' show';
  clearTimeout(t._timer);
  t._timer=setTimeout(function(){t.classList.remove('show')},2500);
}

// ── 主题切换 ──
var THEME_KEY='fm_theme';
function currentTheme(){
  var t=null;
  try{t=localStorage.getItem(THEME_KEY)}catch(e){}
  if(t==='light'||t==='dark') return t;
  return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
}
function applyThemeIcon(){
  var icon=document.getElementById('themeIcon');
  if(icon) icon.textContent=currentTheme()==='dark'?'light_mode':'dark_mode';
}
function toggleTheme(){
  var next=currentTheme()==='dark'?'light':'dark';
  try{localStorage.setItem(THEME_KEY,next)}catch(e){}
  document.documentElement.dataset.theme=next;
  applyThemeIcon();
}

// ── 时间本地化渲染（服务器只传时间戳，避免容器时区问题）──
function renderTimes(){
  var tds=document.querySelectorAll('.file-time[data-mtime]');
  for(var i=0;i<tds.length;i++){
    var ms=Number(tds[i].dataset.mtime);
    if(ms) tds[i].textContent=new Date(ms).toLocaleString();
  }
}

// ── 当前目录过滤 ──
function applyFilter(){
  var input=document.getElementById('filterInput');
  var q=input?input.value.trim().toLowerCase():'';
  var rows=document.querySelectorAll('tr.file-row');
  for(var i=0;i<rows.length;i++){
    var name=rows[i].dataset.name;
    if(name===undefined) continue;
    rows[i].style.display=!q||name.toLowerCase().indexOf(q)>=0?'':'none';
  }
}

// ── 目录大小 ──
function loadDirSize(){
  if(!document.getElementById('dirSizePill')) return;
  fetch(currentPath+'?action=dirsize').then(function(r){return r.json()}).then(function(d){
    var pill=document.getElementById('dirSizePill');
    if(pill) pill.innerHTML='占用 <b>'+formatSize(d.size)+'</b>（'+d.files+' 文件，'+d.dirs+' 文件夹）';
  }).catch(function(){
    var pill=document.getElementById('dirSizePill');
    if(pill) pill.innerHTML='<b>-</b>';
  });
}

// ── 局部刷新（替代整页 reload，保留侧栏与滚动状态）──
async function refreshList(){
  try{
    var r=await fetch(location.href,{cache:'no-store'});
    if(!r.ok) throw new Error();
    var doc=new DOMParser().parseFromString(await r.text(),'text/html');
    var newWrap=doc.querySelector('.table-wrap');
    var oldWrap=document.querySelector('.table-wrap');
    if(newWrap&&oldWrap) oldWrap.replaceWith(newWrap);
    var newStats=doc.querySelector('.header-stats');
    var oldStats=document.querySelector('.header-stats');
    if(newStats&&oldStats) oldStats.replaceWith(newStats);
    selectedItems.clear();
    updateBatchBar();
    renderTimes();
    applyFilter();
    treeCache={};
    loadDirSize();
  }catch(e){location.reload()}
}

// ── 行操作「更多」菜单（移动端）──
function openRowMenu(btn){
  var menu=document.getElementById('rowMenu');
  if(!menu) return;
  var name=btn.dataset.name;
  var items=[];
  if(btn.dataset.preview) items.push(['preview','visibility','预览']);
  if(!btn.dataset.dir) items.push(['download','download','下载'],['share','share','分享直链']);
  items.push(['rename','edit','重命名'],['move','content_cut','移动'],['copy','content_copy','复制'],['delete','delete','删除']);
  menu.innerHTML=items.map(function(it){
    return '<md-menu-item class="act-btn" data-act="'+it[0]+'" data-name="'+esc(name)+'">'+
      '<md-icon slot="start">'+it[1]+'</md-icon><div slot="headline">'+it[2]+'</div></md-menu-item>';
  }).join('');
  menu.anchorElement=btn;
  menu.open=true;
}

function triggerDownload(name){
  var a=document.createElement('a');
  a.href=currentPath+encodeURIComponent(name)+'?download=1';
  a.download=name;
  a.style.display='none';
  document.body.appendChild(a);
  a.click();
  setTimeout(function(){a.remove()},1000);
  var tpId=addTransferItem({name:name,size:0,type:'download',detail:'已交给浏览器下载'});
  updateTransferItem(tpId,{status:'done'});
  setTimeout(function(){removeTransferItem(tpId)},3000);
}

// 单文件下载链接点击跟踪
document.addEventListener('click',function(e){
  var dlLink=e.target.closest('a[href$="?download=1"]');
  if(dlLink&&dlLink.closest('.file-row')){
    var dlName=decodeURIComponent(dlLink.getAttribute('href').replace('?download=1',''));
    var tpId=addTransferItem({name:dlName,size:0,type:'download',detail:'已交给浏览器下载'});
    updateTransferItem(tpId,{status:'done'});
    setTimeout(function(){removeTransferItem(tpId)},3000);
  }
});

// 操作按钮事件委托（含菜单项）
document.addEventListener('click',function(e){
  var btn=e.target.closest('.act-btn');
  if(!btn) return;
  var act=btn.dataset.act;
  var name=btn.dataset.name;
  if(act==='menu') openRowMenu(btn);
  else if(act==='rename') showRename(name);
  else if(act==='preview') previewFile(name);
  else if(act==='share') shareLink(name);
  else if(act==='download') triggerDownload(name);
  else if(act==='move') setClipboard(name,'move');
  else if(act==='copy') setClipboard(name,'copy');
  else if(act==='delete') deleteItem(name);
  else if(act==='paste') doPaste();
  else if(act==='cancel-clip') clearClipboard();
  else if(act==='batch-delete') batchDelete();
  else if(act==='batch-move') batchMove();
  else if(act==='batch-copy') batchCopy();
  else if(act==='batch-download') batchDownload();
  else if(act==='batch-clear') clearSelection();
});

// ── 多选与批量操作 ──
var selectedItems=new Set();

function clearSelection(){
  selectedItems.clear();
  refreshSelection();
}

function updateBatchBar(){
  var bar=document.getElementById('batchBar');
  if(!bar) return;
  if(selectedItems.size===0){bar.innerHTML='';return}
  var n=selectedItems.size;
  bar.innerHTML='<div class="batch-bar">'+
    '<span>已选 <b>'+n+'</b> 项</span>'+
    '<md-filled-tonal-button type="button" class="act-btn" data-act="batch-download"><md-icon slot="icon">download</md-icon>全部下载</md-filled-tonal-button>'+
    '<md-filled-tonal-button type="button" class="act-btn" data-act="batch-copy"><md-icon slot="icon">content_copy</md-icon>批量复制</md-filled-tonal-button>'+
    '<md-filled-tonal-button type="button" class="act-btn" data-act="batch-move"><md-icon slot="icon">content_cut</md-icon>批量移动</md-filled-tonal-button>'+
    '<md-outlined-button type="button" class="act-btn" data-act="batch-delete"><md-icon slot="icon">delete</md-icon>批量删除</md-outlined-button>'+
    '<md-outlined-button type="button" class="act-btn" data-act="batch-clear" style="margin-left:auto"><md-icon slot="icon">close</md-icon>取消选择</md-outlined-button>'+
    '</div>';
}

function refreshSelection(){
  var cbs=document.querySelectorAll('.row-cb');
  for(var i=0;i<cbs.length;i++){
    var name=cbs[i].dataset.name;
    var row=cbs[i].closest('tr');
    if(selectedItems.has(name)){
      cbs[i].checked=true;
      if(row) row.classList.add('selected');
    } else {
      cbs[i].checked=false;
      if(row) row.classList.remove('selected');
    }
  }
  var selectAll=document.getElementById('selectAll');
  if(selectAll){
    selectAll.checked=cbs.length>0&&selectedItems.size===cbs.length;
    selectAll.indeterminate=selectedItems.size>0&&selectedItems.size<cbs.length;
  }
  updateBatchBar();
}

document.addEventListener('change',function(e){
  if(e.target.id==='selectAll'){
    var cbs=document.querySelectorAll('.row-cb');
    selectedItems.clear();
    if(e.target.checked){
      for(var i=0;i<cbs.length;i++) selectedItems.add(cbs[i].dataset.name);
    }
    refreshSelection();
    return;
  }
  if(e.target.classList.contains('row-cb')){
    var name=e.target.dataset.name;
    var row=e.target.closest('tr');
    if(e.target.checked){
      selectedItems.add(name);
      if(row) row.classList.add('selected');
    } else {
      selectedItems.delete(name);
      if(row) row.classList.remove('selected');
    }
    updateBatchBar();
    var selectAll=document.getElementById('selectAll');
    var cbs=document.querySelectorAll('.row-cb');
    if(selectAll){
      selectAll.checked=cbs.length>0&&selectedItems.size===cbs.length;
      selectAll.indeterminate=selectedItems.size>0&&selectedItems.size<cbs.length;
    }
  }
});

// 选中项里筛出文件（排除文件夹，文件夹无法直接下载）
function selectedFiles(){
  var out=[];
  var cbs=document.querySelectorAll('.row-cb');
  for(var i=0;i<cbs.length;i++){
    if(selectedItems.has(cbs[i].dataset.name)&&!cbs[i].dataset.dir) out.push(cbs[i].dataset.name);
  }
  return out;
}

async function batchDownload(){
  var names=selectedFiles();
  var skipped=selectedItems.size-names.length;
  if(!names.length){
    showToast('选中项均为文件夹，无法直接下载','info');
    return;
  }
  var tpIds=addTransferItems(names.map(function(name){
    return {name:name,size:0,type:'download',detail:'等待中'};
  }));
  showToast('开始下载 '+names.length+' 项'+(skipped?'（跳过 '+skipped+' 个文件夹）':''),'info');

  for(var i=0;i<names.length;i++){
    var name=names[i];
    updateTransferItem(tpIds[i],{status:'active',detail:'下载中 '+(i+1)+'/'+names.length});
    var a=document.createElement('a');
    a.href=currentPath+encodeURIComponent(name)+'?download=1';
    a.download=name;
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    (function(el){setTimeout(function(){el.remove()},1000)})(a);
    updateTransferItem(tpIds[i],{status:'done',progress:100,detail:'已交给浏览器下载'});
    if(i<names.length-1){
      await new Promise(function(resolve){setTimeout(resolve,300)});
    }
  }
  setTimeout(function(){removeTransferItems(tpIds)},5000);
}

async function batchDelete(){
  var names=Array.from(selectedItems);
  if(!names.length) return;
  var okay=await confirmDialog('确定删除选中的 '+names.length+' 项吗？此操作不可恢复。');
  if(!okay) return;
  var ok=0,fail=0,idx=0;
  async function worker(){
    while(idx<names.length){
      var n=names[idx++];
      try{
        var r=await fetch(currentPath+'?action=delete&name='+encodeURIComponent(n),{method:'POST'});
        if(r.ok) ok++; else fail++;
      }catch(e){fail++}
    }
  }
  var ws=[];
  for(var i=0;i<Math.min(4,names.length);i++) ws.push(worker());
  await Promise.all(ws);
  selectedItems.clear();
  showToast('删除完成：成功 '+ok+(fail?'，失败 '+fail:''),fail>0?'info':'success');
  refreshList();
}

function batchMove(){
  var names=Array.from(selectedItems);
  sessionStorage.setItem('clip_name',JSON.stringify(names));
  sessionStorage.setItem('clip_action','move');
  sessionStorage.setItem('clip_src',currentPath);
  showToast('已剪切 '+names.length+' 项，请在目标位置粘贴','info');
  selectedItems.clear();
  refreshSelection();
  renderClipboard();
}

function batchCopy(){
  var names=Array.from(selectedItems);
  sessionStorage.setItem('clip_name',JSON.stringify(names));
  sessionStorage.setItem('clip_action','copy');
  sessionStorage.setItem('clip_src',currentPath);
  showToast('已复制 '+names.length+' 项，请在目标位置粘贴','info');
  selectedItems.clear();
  refreshSelection();
  renderClipboard();
}

// ── 上传 ──
var uploadArea=document.getElementById('uploadArea');
var fileInput=document.getElementById('fileInput');
var folderInput=document.getElementById('folderInput');

['dragenter','dragover'].forEach(function(e){uploadArea.addEventListener(e,function(ev){ev.preventDefault();uploadArea.classList.add('dragover')})});
['dragleave','drop'].forEach(function(e){uploadArea.addEventListener(e,function(ev){ev.preventDefault();uploadArea.classList.remove('dragover')})});
uploadArea.addEventListener('drop',function(e){
  e.preventDefault();
  var items=e.dataTransfer.items;
  if(items&&items.length&&items[0].webkitGetAsEntry){
    readDropEntries(items).then(function(files){handleFiles(files)});
  } else {
    handleFiles(e.dataTransfer.files);
  }
});
fileInput.addEventListener('change',function(e){handleFiles(e.target.files);e.target.value=''});
folderInput.addEventListener('change',function(e){
  var files=Array.from(e.target.files).map(function(f){
    var relPath=f.webkitRelativePath||'';
    var dirPath=relPath&&relPath.indexOf('/')>=0?relPath.split('/').slice(0,-1).join('/'):'';
    return {file:f,path:dirPath};
  });
  handleFiles(files);
  e.target.value='';
});

function readDropEntries(dataTransferItems){
  var entries=[];
  for(var i=0;i<dataTransferItems.length;i++){
    var entry=dataTransferItems[i].webkitGetAsEntry&&dataTransferItems[i].webkitGetAsEntry();
    if(entry) entries.push(entry);
  }
  return Promise.all(entries.map(function(e){return walkEntry(e,'')}))
    .then(function(results){return results.flat()})
    .catch(function(){return []});
}
function walkEntry(entry,basePath){
  if(entry.isFile){
    return new Promise(function(resolve){
      try{
        entry.file(function(file){resolve([{file:file,path:basePath||''}])});
      }catch(e){resolve([])}
    });
  }
  if(entry.isDirectory){
    var reader=entry.createReader();
    var nextBase=basePath?basePath+'/'+entry.name:entry.name;
    return new Promise(function(resolve){
      var allEntries=[];
      var timer=setTimeout(function(){resolve([])},30000);
      function readBatch(){
        try{
          reader.readEntries(function(batch){
            if(batch.length===0){
              clearTimeout(timer);
              Promise.all(allEntries.map(function(e){
                return walkEntry(e,nextBase);
              })).then(function(r){resolve(r.flat())}).catch(function(){resolve([])});
            } else {
              allEntries=allEntries.concat(Array.from(batch));
              readBatch();
            }
          },function(){clearTimeout(timer);resolve([])});
        }catch(e){clearTimeout(timer);resolve([])}
      }
      readBatch();
    });
  }
  return Promise.resolve([]);
}

function uploadFile(file,filePath,onProgress){
  return new Promise(function(resolve,reject){
    var xhr=new XMLHttpRequest();
    xhr.open('POST',currentPath+'?action=upload');
    xhr.timeout=0;
    xhr.upload.onprogress=function(e){
      if(e.lengthComputable&&onProgress) onProgress(e.loaded,e.total);
    };
    xhr.onload=function(){
      if(xhr.status>=200&&xhr.status<300) resolve(xhr.status);
      else reject(new Error(xhr.responseText||'上传失败'));
    };
    xhr.onerror=function(){reject(new Error('网络错误'))};
    xhr.ontimeout=function(){reject(new Error('上传超时'))};
    var fd=new FormData();
    if(filePath) fd.append('path',filePath);
    fd.append('file',file);
    xhr.send(fd);
  });
}

async function handleFiles(files){
  if(!files.length) return;
  closeModal('uploadModal');
  var items=[];
  for(var i=0;i<files.length;i++){
    var f=files[i];
    if(f.file) items.push(f);
    else items.push({file:f,path:''});
  }
  var totalSize=0;
  for(var i=0;i<items.length;i++) totalSize+=items[i].file.size;
  var uploadedSize=0;
  var inFlightLoaded={};
  var isBulk=items.length>20;

  var summaryId=null;
  var tpIds=[];
  if(isBulk){
    var folderName=items[0].path?items[0].path.split('/')[0]:'文件';
    summaryId=addTransferItem({name:folderName+' ('+items.length+' 个文件)',size:totalSize,type:'upload'});
  } else {
    tpIds=addTransferItems(items.map(function(it){
      return {name:it.path?it.path+'/'+it.file.name:it.file.name,size:it.file.size,type:'upload'};
    }));
  }

  await new Promise(function(r){setTimeout(r,50)});

  var okCount=0,failCount=0;
  var avgSize=items.length?totalSize/items.length:0;
  var CONCURRENCY=avgSize>100*1024*1024?2:(items.length>20?4:6);
  var idx=0;
  var lastUpdate=0;

  function getUploadedBytes(){
    var bytes=uploadedSize;
    for(var k in inFlightLoaded) bytes+=inFlightLoaded[k];
    return Math.min(bytes,totalSize);
  }

  function updateProgress(force){
    var now=Date.now();
    if(!force&&now-lastUpdate<100) return;
    lastUpdate=now;
    var currentBytes=getUploadedBytes();
    var pct=totalSize?Math.round(currentBytes/totalSize*100):Math.round(okCount/items.length*100);
    if(summaryId) updateTransferItem(summaryId,{progress:pct,detail:okCount+'/'+items.length+'  '+formatSize(currentBytes)+'/'+formatSize(totalSize)});
  }

  function next(){
    if(idx>=items.length) return Promise.resolve();
    var i=idx++;
    var it=items[i];
    var file=it.file;
    var lastItemUpdate=0;
    if(!isBulk) updateTransferItem(tpIds[i],{status:'active',detail:formatSize(file.size)});
    return uploadFile(file,it.path,function(loaded,total){
      inFlightLoaded[i]=loaded;
      updateProgress(false);
      if(!isBulk){
        var now=Date.now();
        if(now-lastItemUpdate>=150||loaded===total){
          lastItemUpdate=now;
          updateTransferItem(tpIds[i],{progress:total?loaded/total*100:0,detail:formatSize(loaded)+'/'+formatSize(total)});
        }
      }
    }).then(function(){
      delete inFlightLoaded[i];
      uploadedSize+=file.size;
      if(!isBulk) updateTransferItem(tpIds[i],{status:'done',progress:100,detail:'完成'});
      okCount++;
      updateProgress(true);
      return next();
    }).catch(function(e){
      delete inFlightLoaded[i];
      if(!isBulk) updateTransferItem(tpIds[i],{status:'error',detail:e.message||'上传失败'});
      failCount++;
      updateProgress(true);
      return next();
    });
  }

  var workers=[];
  for(var w=0;w<Math.min(CONCURRENCY,items.length);w++) workers.push(next());
  await Promise.all(workers);

  if(summaryId) updateTransferItem(summaryId,{status:failCount?'error':'done',progress:100,detail:failCount?'成功'+okCount+'，失败'+failCount:'完成'});
  showToast(failCount===0?'上传完成，共 '+okCount+' 个文件':'上传结束：成功 '+okCount+'，失败 '+failCount,failCount?'info':'success');
  var allIds=summaryId?[summaryId]:tpIds;
  setTimeout(function(){removeTransferItems(allIds)},10000);
  refreshList();
}

// ── 新建 / 删除 / 重命名 ──
async function createFolder(){
  var name=document.getElementById('folderName').value.trim();
  if(!name){showToast('请输入文件夹名称','info');return}
  try{
    var r=await fetch(currentPath+'?action=mkdir&name='+encodeURIComponent(name),{method:'POST'});
    if(r.ok){
      closeModal('folderModal');
      document.getElementById('folderName').value='';
      showToast('创建成功','success');
      refreshList();
    } else showToast('创建失败','info');
  }catch(e){showToast('创建失败','info')}
}

async function deleteItem(name){
  var okay=await confirmDialog('确定删除 "'+name+'" 吗？此操作不可恢复。');
  if(!okay) return;
  try{
    var r=await fetch(currentPath+'?action=delete&name='+encodeURIComponent(name),{method:'POST'});
    if(r.ok){showToast('删除成功','success');refreshList()}
    else showToast('删除失败: '+await r.text(),'info');
  }catch(e){showToast('删除失败','info')}
}

var renameTarget='';
function showRename(name){
  renameTarget=name;
  document.getElementById('renameOldName').textContent='原名称: '+name;
  var input=document.getElementById('renameNewName');
  input.value=name;
  showDialog('renameModal');
  setTimeout(function(){input.focus();if(typeof input.select==='function')input.select()},100);
}
async function doRename(){
  var newName=document.getElementById('renameNewName').value.trim();
  if(!newName){showToast('请输入新名称','info');return}
  if(newName===renameTarget){closeModal('renameModal');return}
  try{
    var r=await fetch(currentPath+'?action=rename&name='+encodeURIComponent(renameTarget)+'&newname='+encodeURIComponent(newName),{method:'POST'});
    if(r.ok){closeModal('renameModal');showToast('重命名成功','success');refreshList()}
    else showToast('重命名失败: '+await r.text(),'info');
  }catch(e){showToast('重命名失败','info')}
}

// ── 预览 ──
var previewList=[];
var previewIndex=-1;

function collectPreviewList(){
  var btns=document.querySelectorAll('.file-actions .act-btn[data-act="preview"]');
  var out=[];
  for(var i=0;i<btns.length;i++){
    var row=btns[i].closest('tr');
    if(row&&row.style.display==='none') continue;
    out.push(btns[i].dataset.name);
  }
  return out;
}

function updatePreviewNav(){
  var prev=document.getElementById('previewPrev');
  var next=document.getElementById('previewNext');
  var multi=previewList.length>1;
  if(prev) prev.classList.toggle('hidden',!multi);
  if(next) next.classList.toggle('hidden',!multi);
}

function previewStep(d){
  if(previewList.length<2) return;
  previewIndex=(previewIndex+d+previewList.length)%previewList.length;
  renderPreview(previewList[previewIndex]);
}

async function renderPreview(name){
  var ext=extOf(name);
  var url=currentPath+encodeURIComponent(name);
  var content=document.getElementById('previewContent');
  var nameEl=document.getElementById('previewName');
  nameEl.textContent=name;
  content.innerHTML='';

  if(PV.image.indexOf(ext)>=0){
    content.innerHTML='<img src="'+url+'" alt="'+esc(name)+'">';
  } else if(PV.video.indexOf(ext)>=0){
    content.innerHTML='<video src="'+url+'" controls autoplay style="max-width:90%;max-height:80vh"></video>';
    var v=content.querySelector('video');
    v.addEventListener('error',function(){
      content.innerHTML='<div class="preview-fallback">该格式无法在浏览器中播放<br><a href="'+url+'?download=1">下载文件</a></div>';
    });
  } else if(PV.audio.indexOf(ext)>=0){
    content.innerHTML='<audio src="'+url+'" controls autoplay></audio>';
  } else {
    // 文本只取前 256KB，避免大文件拖垮浏览器
    try{
      var LIMIT=256*1024;
      var r=await fetch(url,{headers:{'Range':'bytes=0-'+(LIMIT-1)}});
      var text=await r.text();
      var note='';
      var cr=r.headers.get('Content-Range');
      if(r.status===206&&cr){
        var total=Number(cr.split('/')[1]);
        if(total>LIMIT) note='仅显示前 256KB（共 '+formatSize(total)+'），完整内容请下载查看';
      }
      content.innerHTML='<pre>'+esc(text)+'</pre>'+(note?'<div class="preview-note">'+note+'</div>':'');
    }catch(e){
      content.innerHTML='<p style="color:#fff">无法预览此文件</p>';
    }
  }
}

function previewFile(name){
  previewList=collectPreviewList();
  previewIndex=previewList.indexOf(name);
  updatePreviewNav();
  renderPreview(name);
  document.getElementById('previewOverlay').classList.add('show');
}

function closePreview(){
  document.getElementById('previewOverlay').classList.remove('show');
  document.getElementById('previewContent').innerHTML='';
}

document.getElementById('previewOverlay').addEventListener('click',function(e){
  if(e.target===this) closePreview();
});

document.addEventListener('keydown',function(e){
  var previewOpen=document.getElementById('previewOverlay').classList.contains('show');
  if(e.key==='Escape'){
    closeModal('uploadModal');closeModal('folderModal');closeModal('renameModal');closeModal('shareModal');closeModal('confirmModal');
    closePreview();
  } else if(previewOpen&&e.key==='ArrowLeft'){previewStep(-1)}
  else if(previewOpen&&e.key==='ArrowRight'){previewStep(1)}
});

// ── 分享直链 ──
function shareLink(name){
  var url=location.origin+currentPath+encodeURIComponent(name);
  document.getElementById('shareFileName').textContent=name;
  document.getElementById('shareLinkField').value=url;
  showDialog('shareModal');
}
async function copyShareLink(){
  var url=document.getElementById('shareLinkField').value;
  var ok=false;
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      await navigator.clipboard.writeText(url);
      ok=true;
    }
  }catch(e){}
  if(!ok){
    try{
      var ta=document.createElement('textarea');
      ta.value=url;
      ta.style.position='fixed';
      ta.style.opacity='0';
      document.body.appendChild(ta);
      ta.select();
      ok=document.execCommand('copy');
      ta.remove();
    }catch(e){}
  }
  showToast(ok?'直链已复制到剪贴板':'复制失败，请手动复制',ok?'success':'info');
}
function openShareLink(){
  window.open(document.getElementById('shareLinkField').value,'_blank');
}

// ── 剪贴板式移动/复制 ──
function setClipboard(name,action){
  sessionStorage.setItem('clip_name',name);
  sessionStorage.setItem('clip_action',action);
  sessionStorage.setItem('clip_src',currentPath+encodeURIComponent(name));
  showToast((action==='move'?'已剪切':'已复制')+' '+name+'，请在目标位置粘贴','info');
  renderClipboard();
}
function clearClipboard(){
  sessionStorage.removeItem('clip_name');
  sessionStorage.removeItem('clip_action');
  sessionStorage.removeItem('clip_src');
  renderClipboard();
}
function renderClipboard(){
  var name=sessionStorage.getItem('clip_name');
  var action=sessionStorage.getItem('clip_action');
  var bar=document.getElementById('clipboardBar');
  var toolbar=document.getElementById('toolbarPaste');
  if(!name||!action){
    if(bar) bar.innerHTML='';
    if(toolbar) toolbar.innerHTML='';
    return;
  }
  var isMove=action==='move';
  var label=isMove?'剪切':'复制';
  var icon=isMove?'<md-icon>content_cut</md-icon>':'<md-icon>content_copy</md-icon>';
  var cls=isMove?'move':'copy';
  var isBatch=name.startsWith('[');
  var display;
  if(isBatch){
    var arr;
    try{arr=JSON.parse(name)}catch(e){clearClipboard();return}
    if(!Array.isArray(arr)){clearClipboard();return}
    display=icon+' 已'+label+' <b>'+arr.length+'</b> 项';
  } else {
    display=icon+' 已'+label+' <b>'+esc(name)+'</b>';
  }
  bar.innerHTML='<div class="clipboard-bar '+cls+'">'+
    '<span>'+display+'</span>'+
    '<span class="hide-mobile" style="opacity:0.7;font-size:13px">→ 浏览到目标文件夹后点击右侧按钮粘贴</span>'+
    '</div>';
  var cancelBtn=document.createElement('md-text-button');
  cancelBtn.className='act-btn';
  cancelBtn.setAttribute('type','button');
  cancelBtn.setAttribute('data-act','cancel-clip');
  cancelBtn.style.cssText='margin-left:auto;opacity:0.8';
  cancelBtn.innerHTML='<md-icon slot="icon">close</md-icon>取消';
  bar.querySelector('.clipboard-bar').appendChild(cancelBtn);
  toolbar.innerHTML='';
  var pasteBtn=document.createElement('md-filled-button');
  pasteBtn.className='act-btn';
  pasteBtn.setAttribute('type','button');
  pasteBtn.setAttribute('data-act','paste');
  pasteBtn.innerHTML='<md-icon slot="icon">content_paste</md-icon>粘贴到此处';
  toolbar.appendChild(pasteBtn);
}
function getClipDir(){
  var src=sessionStorage.getItem('clip_src')||'';
  var name=sessionStorage.getItem('clip_name')||'';
  if(!name.startsWith('[')){
    var idx=src.lastIndexOf('/');
    src=src.substring(0,idx+1);
  }
  return src;
}

async function doPaste(){
  var name=sessionStorage.getItem('clip_name');
  var action=sessionStorage.getItem('clip_action');
  var srcBase=sessionStorage.getItem('clip_src');
  if(!name||!action) return;
  var label=action==='move'?'移动':'复制';
  var srcDir=getClipDir();
  var sameDir=srcDir===currentPath;
  if(sameDir&&action==='move'){
    clearClipboard();
    showToast('已在当前目录，无需移动','info');
    return;
  }
  if(name.startsWith('[')){
    var names;
    try{names=JSON.parse(name)}catch(e){clearClipboard();showToast('剪贴板数据无效','info');return}
    if(!Array.isArray(names)){clearClipboard();showToast('剪贴板数据无效','info');return}
    var ok=0,skip=0,fail=0;
    for(var i=0;i<names.length;i++){
      var n=names[i];
      if(sameDir&&action==='move'){skip++;continue}
      var src=srcBase+encodeURIComponent(n);
      try{
        var r=await fetch(currentPath+'?action='+action+'&name='+encodeURIComponent(n)+'&dest='+encodeURIComponent(currentPath)+'&src='+encodeURIComponent(src),{method:'POST'});
        if(r.ok) ok++; else fail++;
      }catch(e){fail++}
    }
    clearClipboard();
    var msg=label+'完成：成功 '+ok;
    if(skip) msg+='，跳过 '+skip;
    if(fail) msg+='，失败 '+fail;
    showToast(msg,fail>0?'info':'success');
    refreshList();
  } else {
    if(sameDir){clearClipboard();showToast('已在当前目录，无需'+label,'info');return}
    try{
      var r=await fetch(currentPath+'?action='+action+'&name='+encodeURIComponent(name)+'&dest='+encodeURIComponent(currentPath)+'&src='+encodeURIComponent(srcBase),{method:'POST'});
      if(r.ok){clearClipboard();showToast('粘贴成功','success');refreshList()}
      else showToast(label+'失败: '+await r.text(),'info');
    }catch(e){showToast(label+'失败','info')}
  }
}

// ── 传输队列 ──
var transferItems=[];
var transferIdCounter=0;
var tpCollapsed=false;

function createTransferItem(opts){
  return {
    id:++transferIdCounter,
    name:opts.name||'',
    size:opts.size||0,
    type:opts.type||'upload',
    status:'waiting',
    progress:0,
    detail:opts.detail||'',
  };
}

function addTransferItem(opts){
  var item=createTransferItem(opts);
  transferItems.push(item);
  renderTransferPanel();
  showTransferPanel();
  return item.id;
}
function addTransferItems(items){
  var ids=[];
  for(var i=0;i<items.length;i++){
    var item=createTransferItem(items[i]);
    transferItems.push(item);
    ids.push(item.id);
  }
  renderTransferPanel();
  showTransferPanel();
  return ids;
}
function updateTransferItem(id,updates){
  var item=null;
  for(var i=0;i<transferItems.length;i++){
    if(transferItems[i].id===id){
      for(var k in updates) transferItems[i][k]=updates[k];
      item=transferItems[i];
      break;
    }
  }
  if(item) renderTransferProgress(id);
}
function removeTransferItem(id){
  removeTransferItems([id]);
}
function removeTransferItems(ids){
  var idSet={};
  for(var i=0;i<ids.length;i++) idSet[ids[i]]=true;
  transferItems=transferItems.filter(function(t){return !idSet[t.id]});
  renderTransferPanel();
  if(!transferItems.length) hideTransferPanel();
}
function getTransferIcon(status){
  if(status==='waiting') return 'hourglass_empty';
  if(status==='active') return 'sync';
  if(status==='done') return 'check_circle';
  if(status==='error') return 'error';
  return 'radio_button_unchecked';
}
function transferStatusLabel(t){
  if(t.status==='waiting') return '等待中';
  if(t.status==='active') return '传输中 ('+Math.round(t.progress)+'%)';
  if(t.status==='done') return t.type==='download'?'已触发':'完成';
  return '失败';
}
function updateHeaderBar(){
  var countEl=document.getElementById('tpCount');
  var barEl=document.getElementById('tpBar');
  var infoEl=document.getElementById('tpInfo');
  if(!countEl) return;
  var active=transferItems.filter(function(t){return t.status==='active'||t.status==='waiting'});
  var doneItems=transferItems.filter(function(t){return t.status==='done'});
  var errorItems=transferItems.filter(function(t){return t.status==='error'});
  countEl.textContent=active.length||transferItems.length;

  if(barEl){
    if(!transferItems.length){
      barEl.className='tp-header-bar';
      barEl.style.width='0';
    } else if(active.length){
      var totalProgress=0,activeCount=0;
      transferItems.forEach(function(t){
        if(t.status==='active'){totalProgress+=t.progress;activeCount++}
        else if(t.status==='waiting'){activeCount++}
        else if(t.status==='done'){totalProgress+=100;activeCount++}
      });
      var pct=activeCount?Math.round(totalProgress/activeCount):0;
      barEl.className='tp-header-bar active';
      barEl.style.width=pct+'%';
    } else {
      barEl.className='tp-header-bar done';
      barEl.style.width='100%';
    }
  }

  if(infoEl){
    var nameEl=infoEl.querySelector('.tp-header-info-name');
    var pctEl=infoEl.querySelector('.tp-header-info-pct');
    if(!nameEl){
      infoEl.innerHTML='<span class="tp-header-info-name"></span><span class="tp-header-info-pct"></span>';
      nameEl=infoEl.querySelector('.tp-header-info-name');
      pctEl=infoEl.querySelector('.tp-header-info-pct');
    }
    if(active.length){
      var current=transferItems.find(function(t){return t.status==='active'});
      if(current){
        nameEl.textContent=current.name;
        pctEl.textContent=Math.round(current.progress)+'%';
      } else {
        nameEl.textContent=active.length+' 项等待中';
        pctEl.textContent='';
      }
    } else if(doneItems.length||errorItems.length){
      var parts=[];
      if(doneItems.length) parts.push(doneItems.length+' 完成');
      if(errorItems.length) parts.push(errorItems.length+' 失败');
      nameEl.textContent=parts.join('，');
      pctEl.textContent='';
    } else {
      nameEl.textContent='';
      pctEl.textContent='';
    }
  }
}

function buildItemHtml(t){
  return '<div class="tp-item" data-tid="'+t.id+'"><div class="tp-item-icon '+t.status+'"><md-icon>'+getTransferIcon(t.status)+'</md-icon></div>'+
    '<div class="tp-item-info"><div class="tp-item-name">'+esc(t.name)+'</div><div class="tp-item-detail">'+esc(t.detail||formatSize(t.size))+'</div></div>'+
    '<div class="tp-item-status '+t.status+'">'+transferStatusLabel(t)+'</div></div>';
}

function fullRenderBody(){
  var body=document.getElementById('tpBody');
  if(!body) return;
  if(!transferItems.length){
    body.innerHTML='<div class="tp-empty">暂无传输任务</div>';
    return;
  }
  var uploads=transferItems.filter(function(t){return t.type==='upload'});
  var downloads=transferItems.filter(function(t){return t.type==='download'});
  var html='';
  if(uploads.length){
    html+='<div class="tp-group-label">上传</div>';
    uploads.forEach(function(t){html+=buildItemHtml(t)});
  }
  if(downloads.length){
    html+='<div class="tp-group-label">下载</div>';
    downloads.forEach(function(t){html+=buildItemHtml(t)});
  }
  body.innerHTML=html;
}

function updateItemDom(t){
  var el=document.querySelector('.tp-item[data-tid="'+t.id+'"]');
  if(!el) return;
  var iconEl=el.querySelector('.tp-item-icon');
  var detailEl=el.querySelector('.tp-item-detail');
  var statusEl=el.querySelector('.tp-item-status');
  if(iconEl){
    iconEl.className='tp-item-icon '+t.status;
    var iconName=getTransferIcon(t.status);
    var mdIcon=iconEl.querySelector('md-icon');
    if(mdIcon&&mdIcon.textContent!==iconName) mdIcon.textContent=iconName;
  }
  if(detailEl){
    var detail=t.detail||formatSize(t.size);
    if(detailEl.textContent!==detail) detailEl.textContent=detail;
  }
  if(statusEl){
    var statusLabel=transferStatusLabel(t);
    statusEl.className='tp-item-status '+t.status;
    if(statusEl.textContent!==statusLabel) statusEl.textContent=statusLabel;
  }
}

function renderTransferPanel(){
  updateHeaderBar();
  fullRenderBody();
}

function renderTransferProgress(id){
  updateHeaderBar();
  var item=null;
  for(var i=0;i<transferItems.length;i++){
    if(transferItems[i].id===id){item=transferItems[i];break}
  }
  if(item){
    var el=document.querySelector('.tp-item[data-tid="'+item.id+'"]');
    if(el) updateItemDom(item);
    else fullRenderBody();
  }
}
function showTransferPanel(){
  var p=document.getElementById('transferPanel');
  if(p) p.classList.remove('hidden');
}
function hideTransferPanel(){
  var p=document.getElementById('transferPanel');
  if(p) p.classList.add('hidden');
}
function toggleTransferPanel(){
  tpCollapsed=!tpCollapsed;
  var body=document.getElementById('tpBody');
  var toggle=document.getElementById('tpToggle');
  if(body) body.classList.toggle('collapsed',tpCollapsed);
  if(toggle) toggle.classList.toggle('collapsed',tpCollapsed);
}

// ── 侧栏：移动端开关 ──
function toggleSidebar(force){
  var sb=document.getElementById('sidebar');
  var ov=document.getElementById('sidebarOverlay');
  if(!sb||!ov) return;
  var open=force!==undefined?force:!sb.classList.contains('open');
  sb.classList.toggle('open',open);
  ov.classList.toggle('show',open);
}

// ── 侧栏：桌面折叠 ──
var SB_COLLAPSE_KEY='fm_sidebar_collapsed';
function toggleSidebarCollapse(force){
  var sb=document.getElementById('sidebar');
  if(!sb) return;
  var collapsed=force!==undefined?force:!sb.classList.contains('collapsed');
  sb.classList.toggle('collapsed',collapsed);
  try{localStorage.setItem(SB_COLLAPSE_KEY,collapsed?'1':'0')}catch(e){}
}
try{if(localStorage.getItem(SB_COLLAPSE_KEY)==='1')document.getElementById('sidebar').classList.add('collapsed')}catch(e){}

// ── 侧栏：常用目录 ──
var BM_KEY='fm_bookmarks';
function getBookmarks(){
  try{var d=JSON.parse(localStorage.getItem(BM_KEY));return Array.isArray(d)?d:[]}catch(e){return[]}
}
function saveBookmarks(bms){localStorage.setItem(BM_KEY,JSON.stringify(bms))}
function removeBookmark(idx){
  var bms=getBookmarks();
  if(idx<0||idx>=bms.length) return;
  var name=bms[idx].name||bms[idx].path;
  bms.splice(idx,1);
  saveBookmarks(bms);
  renderBookmarks();
  showToast('已移除 "'+name+'"','success');
}
function renderBookmarks(){
  var el=document.getElementById('bookmarkList');if(!el) return;
  var bms=getBookmarks();
  var cp=location.pathname;
  var html='<a class="bookmark-item'+(cp==='/'?' active':'')+'" href="/"><md-icon>home</md-icon><span class="bm-label">根目录</span></a>';
  for(var i=0;i<bms.length;i++){
    var b=bms[i];
    var active=cp===b.path?' active':'';
    var label=b.name||b.path;
    html+='<a class="bookmark-item'+active+'" href="'+esc(b.path)+'">'+
      '<md-icon>folder</md-icon>'+
      '<span class="bm-label">'+esc(label)+'</span>'+
      '<span class="bm-remove" onclick="event.preventDefault();event.stopPropagation();removeBookmark('+i+')" title="移除"><md-icon>close</md-icon></span>'+
      '</a>';
  }
  el.innerHTML=html;
}
function addBookmark(){
  var cp=location.pathname;
  var bms=getBookmarks();
  for(var i=0;i<bms.length;i++){if(bms[i].path===cp){showToast('该目录已在常用列表中','info');return}}
  var name=cp==='/'?'根目录':decodeURIComponent(cp.split('/').filter(Boolean).pop()||cp);
  bms.push({path:cp,name:name});
  saveBookmarks(bms);
  renderBookmarks();
  showToast('已添加 "'+name+'" 到常用目录','success');
}

// ── 侧栏：目录树 ──
var treeCache={};
function encodePath(p){
  return p.split('/').map(encodeURIComponent).join('/');
}
function loadDirs(dirPath,cb){
  if(treeCache[dirPath]){cb(treeCache[dirPath]);return}
  var xhr=new XMLHttpRequest();
  xhr.open('POST','/?action=listdirs&dir='+encodeURIComponent(dirPath));
  xhr.onload=function(){
    if(xhr.status===200){
      try{var dirs=JSON.parse(xhr.responseText);treeCache[dirPath]=dirs;cb(dirs)}catch(e){cb([])}
    } else cb([])
  };
  xhr.onerror=function(){cb([])};
  xhr.send();
}

function buildTreeNode(name,parentPath,depth,currentPathParts){
  var fullPath=parentPath+name+'/';
  var isCurrentPath=false;
  var testParts=fullPath.split('/').filter(Boolean);
  if(testParts.length<=currentPathParts.length){
    isCurrentPath=true;
    for(var i=0;i<testParts.length;i++){
      if(testParts[i]!==currentPathParts[i]){isCurrentPath=false;break}
    }
  }
  var node=document.createElement('div');
  node.className='tree-node';
  var row=document.createElement('a');
  var isActive=isCurrentPath&&testParts.length===currentPathParts.length;
  row.className='tree-row'+(isActive?' active':(isCurrentPath?' in-path':''));
  row.href=encodePath(fullPath);
  row.draggable=false;
  row.style.setProperty('--tree-indent',(depth*18)+'px');
  row.title=name;
  if(isActive) row.setAttribute('aria-current','page');
  row.innerHTML='<span class="tree-chevron empty"><md-icon>chevron_right</md-icon></span>'+
    '<span class="tree-icon"><md-icon>folder</md-icon></span>'+
    '<span class="tree-label">'+esc(name)+'</span>';
  node.appendChild(row);

  var childContainer=document.createElement('div');
  childContainer.className='tree-children';
  node.appendChild(childContainer);

  var chevron=row.querySelector('.tree-chevron');
  var loaded=false;
  var expanded=false;

  function expand(){
    if(expanded) return;
    expanded=true;
    chevron.classList.remove('empty');
    chevron.classList.add('expanded');
    childContainer.classList.add('open');
    if(!loaded){
      loaded=true;
      loadDirs(fullPath,function(dirs){
        for(var i=0;i<dirs.length;i++){
          var child=buildTreeNode(dirs[i],fullPath,depth+1,currentPathParts);
          childContainer.appendChild(child);
        }
        if(dirs.length===0) chevron.classList.add('empty');
      });
    }
  }
  function collapse(){
    expanded=false;
    chevron.classList.remove('expanded');
    childContainer.classList.remove('open');
  }

  chevron.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();
    if(expanded) collapse(); else expand();
  });
  row.addEventListener('click',function(e){
    if(e.target.closest('.tree-chevron')){e.preventDefault();return}
  });

  node._expand=expand;
  node._path=fullPath;
  return node;
}

function decodedPathParts(){
  return location.pathname.split('/').filter(Boolean).map(function(s){
    try{return decodeURIComponent(s)}catch(e){return s}
  });
}

function initDirTree(){
  var container=document.getElementById('dirTree');
  if(!container) return;
  var currentParts=decodedPathParts();
  loadDirs('/',function(dirs){
    for(var i=0;i<dirs.length;i++){
      var node=buildTreeNode(dirs[i],'/',0,currentParts);
      container.appendChild(node);
    }
    autoExpandPath(container,currentParts);
  });
}

function autoExpandPath(container,parts){
  if(parts.length===0) return;
  var nodes=container.querySelectorAll(':scope > .tree-node');
  for(var i=0;i<nodes.length;i++){
    var label=nodes[i].querySelector('.tree-label');
    if(label&&label.textContent===parts[0]){
      if(typeof nodes[i]._expand==='function') nodes[i]._expand();
      if(parts.length>1){
        var remaining=parts.slice(1);
        var childContainer=nodes[i].querySelector('.tree-children');
        if(childContainer){
          var observer=new MutationObserver(function(muts,obs){
            if(childContainer.children.length>0){
              obs.disconnect();
              autoExpandPath(childContainer,remaining);
            }
          });
          observer.observe(childContainer,{childList:true});
          setTimeout(function(){observer.disconnect()},5000);
        }
      }
      break;
    }
  }
}

// ── 初始化 ──
function init(){
  try{renderClipboard()}catch(e){}
  renderTimes();
  applyThemeIcon();
  loadDirSize();
  try{renderBookmarks()}catch(e){}
  try{initDirTree()}catch(e){}
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();

// 组件就绪后立即显示；兜底 2 秒后无论如何显示
if(window.customElements&&customElements.whenDefined){
  customElements.whenDefined('md-dialog').then(function(){document.documentElement.classList.add('ready')});
}
setTimeout(function(){document.documentElement.classList.add('ready')},2000);
