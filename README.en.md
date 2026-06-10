# winFM

A lightweight web-based file manager powered by Docker, implemented in a single Node.js file with zero external dependencies.

📦 **Docker Hub Image**: [lagee/winfm](https://hub.docker.com/r/lagee/winfm)

🌐 **Language**: [English](README.en.md) | [中文](README.md)

## 🖼️ Screenshot

![winFM Screenshot](IMG_0913.jpeg)

## ✨ Features

### 📂 File Management
- 📤 File upload (drag & drop + multi-file + progress indicator)
- 📁 Create / Delete / Rename files and folders
- ✂️📋 Move / Copy files (clipboard-style operations)
- 📦 Batch select, delete, move, copy
- ⬇️ Single file / Batch download (direct transfer per file, no archiving)
- 🔗 Share direct link (generate direct file URLs for easy sharing)
- 📊 Async directory size calculation (real-time display of directory size, file and folder count)

### 👁️ File Preview
- 🖼️ Image preview (PNG, JPG, GIF, SVG, WebP)
- 🎬 Video playback (MP4, WebM)
- 🎵 Audio playback (MP3, WAV)
- 📄 Text / Code file preview (syntax highlighting for multiple languages)
- 📑 PDF, Office documents (Word, Excel, PowerPoint)

### 🔀 Sorting & Navigation
- Sort by name / size / modified time (ascending / descending)
- Folder-first grouped display
- 🍞 Breadcrumb navigation
- 📂 Sidebar layout (directory tree + bookmarked directories, collapsible/expandable)

### 🎨 Interface Design
- 📱 Responsive design, fully mobile-friendly
- 🎨 Material Design 3 orange theme (Material Web components + Material Symbols icons, auto dark/light mode)
- ⌨️ Keyboard shortcuts (ESC to close dialogs)

### 🔒 Security
- Path traversal attack protection
- Filename safety validation
- Symlink safety checks

## 🚀 Quick Start

### Using Docker Hub Image (Fastest)

```bash
# Pull the pre-built image
docker pull lagee/winfm:latest

# Run the container
docker run -d \
  --name file-manager \
  -p 8888:8888 \
  -v /your/local/path:/data \
  lagee/winfm:latest

# Access
# http://localhost:8888
```

### Using Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
services:
  file-manager:
    image: lagee/winfm:latest
    container_name: file-manager
    restart: unless-stopped
    ports:
      - "8888:8888"
    volumes:
      - /your/local/path:/data
```

Then run:

```bash
docker compose up -d
```

### Build from Source

```bash
# Clone the repository
git clone https://github.com/lageev/winFM.git
cd winFM

# Build and start
docker compose up -d

# Or build manually
docker build -t winfm .
docker run -d -p 8888:8888 -v /your/local/path:/data winfm
```

## ⚙️ Configuration

### Mount Directory

Edit `docker-compose.yml` to change the mount directory:

```yaml
services:
  file-manager:
    image: lagee/winfm:latest
    container_name: file-manager
    restart: unless-stopped
    ports:
      - "8888:8888"
    volumes:
      - /your/local/path:/data   # Map local directory to /data in container
```

### Environment Variable Configuration

Use a `.env` file to configure local paths, making it easy to use different configurations in different environments:

```bash
# Copy the template and modify
cp .env.example .env
```

Edit the `.env` file:

```env
# Local path to the data directory
DATA_DIR=/your/local/path
```

Reference `${DATA_DIR}` in `docker-compose.yml`:

```yaml
volumes:
  - ${DATA_DIR}:/data
```

> **Note**: The `.env` file is ignored by `.gitignore` and will not be synced to the remote repository.

### Port Configuration

Default port is `8888`, can be changed in `docker-compose.yml`:

```yaml
ports:
  - "8080:8888"  # Change to port 8080
```

### Local Configuration (Not synced to remote)

If you need to keep local-specific configurations (such as mount paths, ports, etc.), you can create local config files:

```bash
# Copy config files to local versions
cp docker-compose.yml docker-compose.local.yml
cp watch-deploy.ps1 watch-deploy.local.ps1
```

Then edit `docker-compose.local.yml` with your local paths:

```yaml
services:
  file-manager:
    image: lagee/winfm:latest
    container_name: file-manager
    restart: unless-stopped
    ports:
      - "8888:8888"
    volumes:
      - D:/your/local/path:/data  # Change to your local path
```

Run with local config:

```bash
# Start with local config file
docker compose -f docker-compose.local.yml up -d

# Use local watch script
.\watch-deploy.local.ps1
```

> **Note**: `*.local.yml` and `*.local.ps1` files are ignored by `.gitignore` and will not be synced to the remote repository.

### ⚠️ Directory Permission Issues

The container runs as a non-root user `nodejs` (uid=1001). If subdirectories in the mounted volume were created by other tools (e.g., Syncthing, Samba), they may be owned by root with `755` permissions, causing upload failures.

**Symptoms**: Uploads work in the root directory but fail in certain subdirectories.

**Solution**: Fix permissions on the host:

```bash
# Linux/Mac
chmod -R 777 /your/local/path

# Windows (run inside the container)
docker exec -u root file-manager chmod -R 777 /data/
```

**Alternatively**, run as root in `docker-compose.yml` (simpler but slightly less secure):

```yaml
services:
  file-manager:
    image: lagee/winfm:latest
    container_name: file-manager
    restart: unless-stopped
    user: "0:0"  # Run as root
    ports:
      - "8888:8888"
    volumes:
      - ${DATA_DIR}:/data
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 20 (Alpine)
- **Dependencies**: None (pure standard library implementation)
- **UI Components**: Material Web (Material Design 3)
- **Icons**: Material Symbols
- **Styles**: Material Design 3 design tokens (native CSS, no build step)

## 📁 Supported File Types

| Type | Extensions |
|------|-----------|
| Images | PNG, JPG, JPEG, GIF, SVG, WebP, ICO |
| Video | MP4, WebM |
| Audio | MP3, WAV |
| Documents | PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, CSV |
| Code | HTML, CSS, JS, JSON, TypeScript, JSX, TSX, Vue, Python, Java, C/C++, Go, Rust, etc. |
| Other | TXT, MD, YAML, YML, XML, LOG, Shell scripts |

## 📝 Usage

1. **Upload files**: Click the upload button or drag files directly onto the page
2. **Create folder**: Click the folder icon button
3. **Batch operations**: Select multiple files and use the bottom action bar
4. **Sort**: Click the name, size, or time column headers to sort
5. **Preview**: Click the eye icon next to the file name
6. **Download**: Click the download icon, or batch select and download one by one (for folders, enter the folder first then select files)
7. **Share link**: Click the share icon in the file action column to copy the direct link
8. **Sidebar navigation**: Click the menu icon in the top-left corner to expand the sidebar, view directory tree and bookmarked directories
9. **Directory size**: The top statistics bar asynchronously displays the current directory size

## 📄 License

MIT License
