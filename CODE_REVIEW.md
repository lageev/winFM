# winFM 代码审查报告

> 审查日期：2026-06-11  
> 审查方式：静态代码审查  
> 审查范围：Node.js 后端、前端静态资源、Docker/Compose 配置与辅助脚本  
> 说明：按项目 `AGENTS.md` 要求，本次只做代码梳理与文档输出，未执行编译、构建或运行验证。

## 项目概览

winFM 是一个轻量级 Web 文件管理器，核心实现为 Node.js 原生 HTTP 服务：

- 后端入口：`file-manager.js` -> `src/index.js` -> `src/handlers/index.js`
- 核心能力：目录浏览、文件上传、下载/Range、重命名、删除、移动/复制、目录大小统计
- 前端：服务端模板 `src/template.js` 生成 HTML，交互逻辑集中在 `src/static/app.js`
- 部署：`Dockerfile`、`docker-compose.yml`
- 主要运行依赖：`busboy`

整体代码结构清晰，路径遍历、基础文件名校验、符号链接跳过、Basic Auth、CSRF 请求头检查等防护已有雏形。但由于该项目直接管理宿主机/容器挂载目录，任意文件读写和同源文件预览会放大安全问题，建议优先处理下列高风险项。

## 优先级总览

| 优先级 | 问题 | 影响 |
| --- | --- | --- |
| P0 | 用户上传的 HTML/SVG 等主动内容在文件管理器同源下执行 | 可形成存储型 XSS，并调用同源文件操作接口 |
| P0 | 上传子目录路径未做真实路径校验，遇到 ROOT 内符号链接可能写出根目录 | 可越过 `ROOT` 写入外部路径 |
| P1 | 上传与普通 POST 缺少总量/速率/超时限制 | 磁盘耗尽、连接耗尽或请求堆积 |
| P1 | `.dirsize-cache.json` 位于 ROOT 下且可直接下载 | 泄露绝对路径和目录统计缓存 |
| P1 | CSRF 防护只依赖浏览器请求头 | 旧客户端/代理场景下仍可能被跨站触发写操作 |
| P2 | 错误信息、同步 I/O、同步 gzip、递归目录统计 | 信息泄露、性能抖动、DoS 风险 |
| P2 | Dockerfile 忽略依赖安装失败 | 镜像可能构建成功但运行时崩溃 |
| P3 | 前端刷新/下载/目录树等体验与性能问题 | 大目录或大量文件时体验下降 |

## 详细问题

### P0：用户文件按主动 MIME 同源直出，存在存储型 XSS 风险

证据：

- `src/config.js:17-21` 将 `.html`、`.htm`、`.js`、`.json` 等配置为可直接浏览的类型
- `src/config.js:29` 将 `.svg` 配置为 `image/svg+xml`
- `src/handlers/get.js:91-96` 非下载模式直接使用 `MIME[ext]` 输出文件
- `src/static/app.js:622-631` 预览图片/音视频时把文件 URL 放进同源页面

影响：

用户只要能上传或放置一个 `html` 文件，打开它时脚本就在文件管理器同源下运行。该脚本虽然读不到 Basic Auth 明文，但浏览器会自动携带同源认证状态，脚本可以向 `?action=delete`、`?action=rename`、`?action=upload` 等接口发起请求，进而删除、覆盖或搬移文件。SVG 直接打开时也属于主动内容风险。

建议：

1. 默认把用户文件作为不可信内容处理，主动内容类型强制下载：
   - `.html`、`.htm`、`.svg`、`.xml`、`.js` 等返回 `Content-Disposition: attachment`
   - 同时加 `X-Content-Type-Options: nosniff`
2. 如果必须内联预览，建议把用户文件放到独立 origin 或独立子域，避免与管理页面同源。
3. 对用户文件响应单独加严格 CSP，例如 `Content-Security-Policy: sandbox; default-src 'none'; img-src 'self' blob: data:; media-src 'self' blob:`，但不要影响主应用页面。
4. 主应用页面也应逐步移除内联事件处理器，便于使用不含 `unsafe-inline` 的 CSP。

### P0：上传文件夹时可能通过符号链接写出 ROOT

证据：

- `src/handlers/upload.js:7-11` `safeFolderPath` 只做字符串级别的路径片段过滤
- `src/handlers/upload.js:75-81` 使用 `path.join(fp, sub)` 得到 `baseDir` 后直接 `mkdirSync`
- `src/handlers/upload.js:98-105` 随后在 `baseDir` 下创建临时文件并 `rename`
- 当前流程没有对 `baseDir` 做 `realPathInsideRoot` 或 `ensureSafeDirectory` 校验

影响：

如果 `ROOT` 内已经存在一个目录符号链接，例如 `/data/link -> /host/outside`，攻击者可以构造上传字段 `path=link`，`destPath` 在字符串上仍像 `/data/link/file`，但实际写入会跟随符号链接落到 `/host/outside/file`。这绕过了 `ROOT` 边界。

建议：

1. 不要直接对 `path.join(fp, sub)` 调用递归 `mkdirSync`。应从已验证的 `fp` 开始逐级处理 `sub`：
   - 每一级如果已存在，先 `lstat`，发现符号链接立即拒绝。
   - 每一级如果不存在，只创建当前这一级。
   - 每次进入下一级后用真实路径确认仍在 `ROOT` 内。

示意：

```js
let baseDir = fp;
for (const part of safeParts) {
  const next = path.join(baseDir, part);
  if (fs.existsSync(next)) {
    if (fs.lstatSync(next).isSymbolicLink()) {
      throw userError('不允许上传到符号链接目录');
    }
  } else {
    fs.mkdirSync(next);
  }
  if (!ensureSafeDirectory(next)) throw userError('Invalid directory');
  baseDir = next;
}
```

2. 临时文件名不要只拼接在目标路径后，建议统一写到已验证真实路径安全的目录中。
3. 写入前后都要处理 TOCTOU 风险；如果运行环境允许，可用更底层的 no-follow/openat 语义收紧窗口。

### P1：上传缺少文件大小与总请求大小限制

证据：

- `src/handlers/upload.js:16-26` Busboy 只限制 `files`、`fields`、`parts`、`fieldSize`
- 未设置 `limits.fileSize`
- 未限制总请求体大小、总并发上传数、剩余磁盘空间

影响：

任意认证用户或被 XSS/CSRF 借用身份的浏览器，都可以持续上传超大文件直到磁盘写满。磁盘耗尽后，缓存写入、文件操作、容器日志等都会受影响。

建议：

1. 增加环境变量，例如 `FM_MAX_FILE_SIZE`、`FM_MAX_UPLOAD_BYTES`。
2. Busboy 设置 `fileSize`，并监听 `file.on('limit')`，及时删除临时文件。
3. 上传前后检查可用磁盘空间，至少在 Docker 部署文档中提示配额。
4. 对上传接口做基于 IP/用户的并发限制。

### P1：普通 POST 不消费也不限制请求体

证据：

- `src/handlers/index.js:89-116` 所有 POST action 通过 query 参数驱动
- `src/handlers/actions.js`、`src/handlers/batch.js` 不读取 body，也没有上限

影响：

攻击者可以对 `mkdir/delete/rename/listdirs` 等接口发送超大或极慢 body。服务端可能在响应已结束后仍被客户端连接占用，形成慢请求/连接耗尽风险。

建议：

1. 对非上传 POST 统一拒绝带 body 的请求，或限制到很小的大小，例如 1KB。
2. 在入口处按 action 分流前增加 `Content-Length` 校验。
3. 设置 HTTP server 超时：`requestTimeout`、`headersTimeout`、`keepAliveTimeout`。

### P1：目录大小缓存文件可被直接下载

证据：

- `src/config.js:13` 缓存文件名为 `.dirsize-cache.json`
- `src/handlers/index.js:13` 缓存文件路径为 `path.join(ROOT, SIZE_CACHE_NAME)`
- `src/handlers/get.js:28-30` 只在根目录列表中过滤该文件
- `src/handlers/get.js:67-116` 没有禁止 GET `/.dirsize-cache.json`

影响：

该文件包含绝对路径 key 和目录统计结果。即使服务需要认证，也不应该把内部缓存暴露成用户文件，因为它会泄露容器内路径结构和被访问过的目录。

建议：

1. 推荐把缓存移到 `ROOT` 外，例如 `/tmp/winfm/.dirsize-cache.json` 或专用 app data 目录。
2. 同时在 GET 层显式禁止访问 `SIZE_CACHE_NAME`：

```js
if (path.basename(fp) === SIZE_CACHE_NAME) {
  res.writeHead(403);
  res.end('Forbidden');
  return;
}
```

### P1：CSRF 防护不够稳固

证据：

- `src/handlers/index.js:60-70` 只检查 `Sec-Fetch-Site` 和 `Origin`
- `src/handlers/index.js:90-115` 文件写操作仍是普通 POST + query 参数

影响：

Basic Auth 认证状态会被浏览器自动带到同源请求。当前检查能挡住现代浏览器的大多数跨站 POST，但在旧浏览器、部分代理、非浏览器客户端或缺失 Origin 的请求中，仍可能被放行。与 P0 的同源主动内容问题叠加后，风险更高。

建议：

1. 登录后生成 CSRF token，写入页面 `<meta>` 或 JS 配置，所有写操作带 `X-FM-CSRF`。
2. 服务端校验 token 和 Origin/Fetch Metadata，两者都保留。
3. 把高风险 action 改成 JSON body，避免纯 query 参数触发写操作。

### P2：Basic Auth 比较和暴力尝试防护不足

证据：

- `src/handlers/index.js:51-58` 使用 `===` 比较 Authorization
- 没有失败次数限制、冷却时间或日志审计

影响：

`===` 存在理论上的时序侧信道。更现实的问题是认证端点没有限速，暴露到公网时可被持续暴力尝试。

建议：

1. 使用 `crypto.timingSafeEqual` 做常量时间比较，并避免长度差异直接泄露。
2. 增加 IP 级失败计数和短期封禁。
3. README 中明确建议通过 HTTPS 反向代理暴露服务，避免 Basic Auth 在明文 HTTP 上传输。

### P2：错误信息直接回显可能泄露内部路径

证据：

- `src/index.js:9-12` 返回 `Internal error: ${e.message}`
- `src/handlers/batch.js:16-18` 直接 `res.end(e.message)`

影响：

系统异常消息常包含绝对路径、权限信息或底层 errno。攻击者可以借此了解容器路径、挂载结构和文件权限。

建议：

1. 客户端统一返回脱敏错误，例如 `Internal error`、`读取目录失败`。
2. 详细错误只写服务端日志。
3. 使用统一响应 helper，避免不同 handler 各自写错误。

### P2：缺少统一安全响应头

证据：

- `src/handlers/index.js`、`src/handlers/get.js`、`src/handlers/static.js` 均没有统一安全头注入

影响：

缺少 `nosniff` 会放大用户文件 MIME 风险；缺少 `frame-ancestors`/`X-Frame-Options` 会增加点击劫持面；缺少 CSP 会让 XSS 后果更难收敛。

建议：

1. 在主入口设置基础响应头：

```js
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
res.setHeader('X-Frame-Options', 'DENY');
```

2. 主应用和用户文件使用不同 CSP。不要用同一份宽松 CSP 覆盖所有响应。

### P2：目录列表和部分文件操作使用同步 I/O

证据：

- `src/handlers/get.js:21` `fs.statSync`
- `src/handlers/get.js:28-35` `readdirSync` + 每项 `lstatSync`
- `src/handlers/batch.js:10-13` `readdirSync`
- `src/handlers/actions.js:19`、`56`、`82` 等同步操作

影响：

Node.js 单线程事件循环会被同步文件系统操作阻塞。大目录、慢磁盘、网络挂载目录或并发用户访问时，会出现所有请求一起卡顿。

建议：

1. 目录列表改为 `fs.promises.readdir/stat/lstat`。
2. 大目录分页或虚拟列表，不要一次性渲染全部条目。
3. 写操作中能异步的部分尽量改为 async。

### P2：目录 HTML 使用同步 gzip

证据：

- `src/handlers/get.js:52-59` 对目录 HTML 使用 `zlib.gzipSync`

影响：

目录很大时，HTML 字符串生成和同步 gzip 会连续阻塞事件循环。

建议：

改为 `zlib.gzip` 异步压缩，或者让反向代理负责压缩。

### P2：递归目录大小统计可能造成资源消耗

证据：

- `src/handlers/index.js:119-125` 任意 GET 可触发 `action=dirsize`
- `src/file-ops.js:81-114` 递归遍历目录树，每层按 50 并发批处理
- `src/handlers/index.js:29-37` 每次写操作失效缓存时全量遍历 key

影响：

深目录或海量文件会造成长时间磁盘遍历。多个目录并发请求会叠加 I/O 压力。缓存失效随着缓存数量线性增长。

建议：

1. 给 `dirsize` 增加队列和并发上限，同一路径请求合并。
2. 增加最大深度、最大文件数或超时，超限返回近似值/未知状态。
3. 缓存 key 用 `Map` 管理，并记录父子关系或按目录前缀分桶，降低失效成本。

### P2：移动操作跨文件系统失败

证据：

- `src/handlers/actions.js:77-83` move 直接 `fs.renameSync(src, dest)`

影响：

如果 `ROOT` 内存在不同挂载点，`rename` 会抛 `EXDEV`。Docker volume、NAS、外接盘或 bind mount 混用时比较常见。

建议：

捕获 `EXDEV` 后回退为复制再删除。复制完成前不要删除源文件；失败时保留源文件。

### P2：Dockerfile 忽略依赖安装失败

证据：

- `Dockerfile:5-8`：`RUN npm ci --only=production 2>/dev/null || true`

影响：

依赖安装失败时镜像仍可构建成功，但运行时会因为缺少 `busboy` 等模块崩溃。`2>/dev/null` 还会隐藏关键错误。

建议：

1. 改为 `RUN npm ci --omit=dev`，失败时让构建失败。
2. 不要吞掉 stderr。
3. 如需兼容无 lockfile 场景，应显式分支处理，而不是 `|| true`。

### P2：README 中的权限建议过宽

证据：

- `README.md:214-217` 建议 `chmod -R 777 /your/local/path`
- `README.md:220-229` 建议用 root 用户运行容器作为替代方案

影响：

`777` 和 root 容器会显著扩大文件误删、篡改和逃逸后的影响范围。作为排障临时手段可以理解，但不应作为主要建议。

建议：

1. 首选把宿主目录 owner/group 调整为容器 UID/GID：`1001:1001`。
2. 如果必须放宽权限，建议限定到目标目录，并说明风险。
3. root 运行只作为最后手段，并建议配合只读挂载、备份和网络隔离。

### P3：`getSafePathParam` 双重解码导致含 `%xx` 的文件名操作异常

证据：

- `src/utils.js:72-75` `getSafePathParam` 再次调用 `decodeURIComponent`
- `URLSearchParams.get()` 本身已经完成一次解码
- `src/static/app.js:801`、`814` 又会对 `src` 做 `encodeURIComponent`

影响：

如果文件名本身包含形如 `%2F`、`%2e` 的字面字符，移动/复制时可能被二次解码成 `/` 或 `.`，导致路径含义改变或被误判为非法路径。

建议：

1. 明确接口参数编码规则，避免服务端对 `URLSearchParams.get()` 的结果再次解码。
2. 对路径参数传 JSON body，减少多层 query 编码带来的歧义。

### P3：前端刷新整页 HTML 再局部替换，成本偏高

证据：

- `src/static/app.js:111-129` `refreshList` 请求完整页面，用 `DOMParser` 提取 `.table-wrap` 和 `.header-stats`

影响：

大目录下每次上传/删除/重命名后都重新传输和解析完整 HTML，包括侧栏、对话框、静态结构等重复内容。

建议：

增加 `?action=list` JSON API，前端只更新表格数据。大目录再配合分页或虚拟滚动。

### P3：批量下载通过连续触发多个浏览器下载

证据：

- `src/static/app.js:279-307` 每 300ms 创建一个 `<a>` 触发下载

影响：

大量文件会触发浏览器并发限制、下载拦截或用户确认，体验不稳定。

建议：

增加服务端 zip/tar 打包下载，或至少在前端对大量文件给出“建议打包”的路径。

### P3：目录树接口无分页或深度限制

证据：

- `src/static/app.js:1102-1112` 目录树按节点动态请求
- `src/handlers/batch.js:10-13` 一次返回目标目录下所有子目录

影响：

单层包含大量目录时，侧栏请求会阻塞服务端并造成前端渲染卡顿。

建议：

为目录树接口增加数量上限、搜索或懒加载分页。

## 建议修复路线

第一阶段，先收敛高风险面：

1. 禁止用户文件中的主动内容同源执行：HTML/SVG/XML/JS 默认下载或放到独立 origin。
2. 修复上传 `baseDir` 的真实路径校验，拒绝通过符号链接写出 `ROOT`。
3. 给上传、普通 POST、认证失败增加大小限制、超时和速率限制。
4. 将 `.dirsize-cache.json` 移出 `ROOT`，并在 GET 层显式禁止内部文件。

第二阶段，提升可靠性：

1. 替换同步目录 I/O 和同步 gzip。
2. 给 `dirsize` 增加队列、超时、最大深度/数量限制。
3. 修复 `rename/move` 的 `EXDEV` 回退和二次解码问题。
4. Dockerfile 依赖安装失败时直接失败。

第三阶段，改善体验与维护性：

1. 增加目录列表 JSON API，减少整页 HTML 刷新。
2. 批量下载支持服务端打包。
3. 抽出统一响应 helper，集中处理安全头、错误脱敏和 JSON 输出。

## 未执行项

本次没有执行以下操作：

- 未运行 `npm audit` 或联网 CVE 查询。
- 未启动服务做动态验证。
- 未执行 Docker build、npm build、测试或编译流程。
