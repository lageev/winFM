const fs = require('fs');
const path = require('path');
const { pathExists, realPathInsideRoot, attachmentDisposition } = require('../utils');
const { MIME } = require('../config');
const { getHTML } = require('../template');

function handleGet(req, res, url, rp, fp) {
  if (!pathExists(fp)) {
    res.writeHead(404);
    res.end('<h1>404 Not Found</h1>');
    return;
  }

  if (!realPathInsideRoot(fp)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const st = fs.statSync(fp);

  if (st.isDirectory()) {
    if (!rp.endsWith('/')) { res.writeHead(301, { Location: rp + '/' }); res.end(); return; }

    let items = [];
    try {
      items = fs.readdirSync(fp, { withFileTypes: true }).map(e => {
        const itemPath = path.join(fp, e.name);
        let size = 0, mtime = null;
        try { const s = fs.lstatSync(itemPath); size = s.size; mtime = s.mtime; } catch(ex) {}
        return { name: e.name, isDir: e.isDirectory(), size, mtime };
      });
    } catch(e) {}

    let sortField = url.searchParams.get('sort') || 'name';
    if (!['name','size','mtime'].includes(sortField)) sortField = 'name';
    const sortDir = url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
    const groupDirs = url.searchParams.get('group') !== '0';

    items.sort((a, b) => {
      if (groupDirs && a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let cmp = 0;
      if (sortField === 'size') cmp = a.size - b.size;
      else if (sortField === 'mtime') cmp = (a.mtime ? new Date(a.mtime).getTime() : 0) - (b.mtime ? new Date(b.mtime).getTime() : 0);
      else cmp = a.name.localeCompare(b.name);
      return sortDir === 'desc' ? -cmp : cmp;
    });

    const msgParam = url.searchParams.get('msg');
    let msg = null;
    if (msgParam === 'uploaded') msg = { type: 'success', text: '文件上传成功' };
    else if (msgParam === 'deleted') msg = { type: 'success', text: '删除成功' };

    res.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' });
    res.end(getHTML(items, rp, msg, sortField, sortDir, groupDirs));
    return;
  }

  // Serve file
  const ext = path.extname(fp).toLowerCase();
  const download = url.searchParams.get('download');

  if (download) {
    const dlName = path.basename(fp);
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': attachmentDisposition(dlName),
      'Content-Length': st.size
    });
    fs.createReadStream(fp).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': st.size
  });
  fs.createReadStream(fp).pipe(res);
}

module.exports = { handleGet };
