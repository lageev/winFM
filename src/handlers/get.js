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

  // Serve file (streamed; supports HTTP Range for large files / resumable downloads)
  const ext = path.extname(fp).toLowerCase();
  const download = url.searchParams.get('download');

  const headers = { 'Accept-Ranges': 'bytes' };
  if (download) {
    headers['Content-Type'] = 'application/octet-stream';
    headers['Content-Disposition'] = attachmentDisposition(path.basename(fp));
  } else {
    headers['Content-Type'] = MIME[ext] || 'application/octet-stream';
  }

  let start = 0, end = st.size - 1, status = 200;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && st.size > 0) {
    if (m[1] === '') { start = Math.max(st.size - Number(m[2]), 0); }
    else { start = Number(m[1]); end = m[2] === '' ? end : Number(m[2]); }
    if (!(start >= 0 && end < st.size && start <= end)) {
      res.writeHead(416, { 'Content-Range': 'bytes */' + st.size });
      res.end();
      return;
    }
    status = 206;
    headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + st.size;
  }

  headers['Content-Length'] = end - start + 1;
  res.writeHead(status, headers);
  const stream = fs.createReadStream(fp, { start, end });
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

module.exports = { handleGet };
