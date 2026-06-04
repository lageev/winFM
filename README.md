# winFM

基于 Docker 的轻量级 Web 文件管理器，单文件 Node.js 实现，前端通过 CDN 使用 DaisyUI、Tailwind CSS 和 Lucide。

## 功能

- 📤 文件上传（拖拽 + 多文件）
- 📁 新建 / 删除 / 重命名文件夹
- ✂️📋 移动 / 复制文件（剪贴板式操作）
- 📦 批量选择、删除、移动、复制、打包下载
- 👁️ 文件预览（图片、视频、音频、文本）
- ⬇️ 文件下载
- 🔀 按名称 / 大小 / 修改时间排序
- 🍞 面包屑导航
- 📱 响应式设计，支持移动端

## 快速开始

```bash
# 构建并启动
docker compose up -d

# 访问
# http://localhost:8888
```

## 配置

编辑 `docker-compose.yml` 修改挂载目录：

```yaml
volumes:
  - D:/fileshare:/data   # 将本地目录映射到容器内 /data
```

端口默认 `8888`，可在 `docker-compose.yml` 中修改。

## 技术栈

- **运行时**: Node.js 20 (Alpine)
- **后端依赖**: 无（Node.js 标准库实现）
- **前端 UI**: DaisyUI 5、Tailwind CSS Play CDN、Lucide Icons（CDN）
- **打包**: zip（容器内预装）
