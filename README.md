# winFM

基于 Docker 的轻量级 Web 文件管理器，单文件 Node.js 实现，无外部依赖。

## ✨ 功能特性

### 📂 文件管理
- 📤 文件上传（拖拽 + 多文件 + 进度显示）
- 📁 新建 / 删除 / 重命名文件和文件夹
- ✂️📋 移动 / 复制文件（剪贴板式操作）
- 📦 批量选择、删除、移动、复制
- ⬇️ 单文件 / 批量下载（逐文件直传，不打包）
- 🔗 分享直链功能（生成文件直链地址，方便分享）
- 📊 目录大小异步计算（实时显示目录占用空间、文件和文件夹数量）

### 👁️ 文件预览
- 🖼️ 图片预览（PNG、JPG、GIF、SVG、WebP）
- 🎬 视频播放（MP4、WebM）
- 🎵 音频播放（MP3、WAV）
- 📄 文本 / 代码文件预览（支持多种编程语言高亮）
- 📑 PDF、Office 文档（Word、Excel、PowerPoint）

### 🔀 排序与导航
- 按名称 / 大小 / 修改时间排序（升序 / 降序）
- 文件夹优先分组显示
- 🍞 面包屑导航
- 📂 侧栏布局（包含目录树和常用目录书签，支持折叠/展开）

### 🎨 界面设计
- 📱 响应式设计，完美支持移动端
- 🎨 Material Design 3 橙色系主题（Material Web 组件 + Material Symbols 图标，自动适配深浅色）
- ⌨️ 快捷键支持（ESC 关闭弹窗）

### 🔒 安全特性
- 路径遍历攻击防护
- 文件名安全验证
- 符号链接安全检查

## 🚀 快速开始

### 使用 Docker Compose（推荐）

```bash
# 克隆仓库
git clone https://github.com/lageev/winFM.git
cd winFM

# 构建并启动
docker compose up -d

# 访问
# http://localhost:8888
```

### 使用 Docker

```bash
# 构建镜像
docker build -t winfm .

# 运行容器
docker run -d \
  --name file-manager \
  -p 8888:8888 \
  -v /your/local/path:/data \
  winfm
```

## ⚙️ 配置

### 挂载目录

编辑 `docker-compose.yml` 修改挂载目录：

```yaml
services:
  file-manager:
    build: .
    container_name: file-manager
    restart: unless-stopped
    ports:
      - "8888:8888"
    volumes:
      - /your/local/path:/data   # 将本地目录映射到容器内 /data
```

### 端口配置

端口默认 `8888`，可在 `docker-compose.yml` 中修改：

```yaml
ports:
  - "8080:8888"  # 改为 8080 端口
```

## 🛠️ 技术栈

- **运行时**: Node.js 20 (Alpine)
- **依赖**: 无（纯标准库实现）
- **UI 组件**: Material Web（Material Design 3）
- **图标**: Material Symbols
- **样式**: Material Design 3 设计令牌（原生 CSS，无构建步骤）

## 📁 支持的文件类型

| 类型 | 扩展名 |
|------|--------|
| 图片 | PNG、JPG、JPEG、GIF、SVG、WebP、ICO |
| 视频 | MP4、WebM |
| 音频 | MP3、WAV |
| 文档 | PDF、DOC、DOCX、XLS、XLSX、PPT、PPTX、CSV |
| 代码 | HTML、CSS、JS、JSON、TypeScript、JSX、TSX、Vue、Python、Java、C/C++、Go、Rust 等 |
| 其他 | TXT、MD、YAML、YML、XML、LOG、Shell 脚本 |

## 📝 使用说明

1. **上传文件**: 点击上传按钮或直接拖拽文件到页面
2. **新建文件夹**: 点击文件夹图标按钮
3. **批量操作**: 勾选多个文件后使用底部操作栏
4. **排序**: 点击表头的名称、大小、时间进行排序
5. **预览**: 点击文件名旁的眼睛图标
6. **下载**: 点击下载图标，或批量选择后逐个下载（文件夹请进入后再选择文件）
7. **分享直链**: 点击文件操作列的分享图标，复制文件直链地址
8. **侧栏导航**: 点击左上角菜单图标展开侧栏，查看目录树和常用目录书签
9. **目录大小**: 页面顶部统计栏异步显示当前目录占用空间

## 📄 许可证

MIT License