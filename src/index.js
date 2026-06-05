const http = require('http');
const { PORT } = require('./config');
const { handle } = require('./handlers');

process.on('uncaughtException', (e) => { console.error('uncaughtException:', e.message); });
process.on('unhandledRejection', (e) => { console.error('unhandledRejection:', e); });

const server = http.createServer((req, res) => {
  try { handle(req, res); } catch(e) {
    console.error('Error:', e.message);
    try { res.writeHead(500); res.end('Internal error: ' + e.message); } catch(err) {}
  }
});
server.on('error', (e) => { console.error('server.error:', e.message); });
server.listen(PORT, '0.0.0.0', () => console.log('📂 文件管理已启动 端口:' + PORT + ' 目录:/data'));
