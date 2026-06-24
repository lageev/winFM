# winFM

A lightweight web-based file manager powered by Docker, implemented in Node.js with minimal dependencies.

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
- 🌐 WebDAV support (built-in WebDAV server that other clients can mount; also mount remote WebDAV servers and browse/manage them in the UI)

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
- 📱 Responsive design, fully mobile-friendly (actions collapse into a "More" menu on mobile)
- 🎨 Material Design 3 orange theme (Material Web components + Material Symbols icons, auto dark/light mode, manual toggle)
- 🔍 Instant in-directory search filtering
- 🌐 Components and icon fonts are bundled locally, works offline / in intranet environments
- ⌨️ Keyboard shortcuts (ESC to close dialogs, left/right arrows to navigate files in preview)

### 🖼️ Thumbnails & View Modes
- 🖼️ Auto-generated thumbnails for images and videos (sharp + ffmpeg, memory LRU + disk cache)
- 📐 List / Grid view toggle — grid mode displays media files as thumbnail cards

### 🔒 Security
- Path traversal attack protection
- Filename safety validation
- Symlink safety checks
- CSRF cross-site request protection
- Admin login: form login + signed session cookie; management operations and directory browsing require login
- Anonymous viewing: unauthenticated users can view individual files via direct links, rate-limited per IP with idle timeout reset
- Login failure rate limiting per IP to prevent brute-force attacks

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

### Authentication (Admin Login)

Credential source priority: environment variable > persisted file > unconfigured (first-run setup).

- **First-run setup**: When `FM_PASS` is not set, the first visit redirects to `/__fm/setup` to create an admin username and password online. Credentials (password hashed with scrypt) and session key are persisted to `.fm-auth.json` in the data directory, take effect immediately, and survive restarts.
- **Environment variable config** (skip setup):

```yaml
environment:
  - FM_USER=admin              # Admin username, default admin
  - FM_PASS=yourpassword       # Admin password
  - FM_SECRET=random-long-str  # Session signing key, recommended for persistent sessions
  - FM_SESSION_HOURS=168       # Optional, session TTL in hours, default 7 days
  - FM_OPEN=1                  # Optional, fully public mode, no login required and skips setup
```

- Single admin account only; visiting directory or management pages redirects to login page `/__fm/login`, logout button in top-right corner.
- When using env vars without `FM_SECRET`, the key is randomly generated and sessions are lost on restart (setup-persisted keys don't have this issue).
- Legacy format: `FM_AUTH=admin:yourpassword` (equivalent to `FM_USER` + `FM_PASS`).

### Anonymous Viewing (Unauthenticated)

When authentication is enabled, unauthenticated users can still view individual files via direct links (for external sharing), subject to rate limits; directory browsing and all write operations still require login:

```yaml
environment:
  - FM_ANON=1            # 1 to enable (default), 0 to disable (all access requires login)
  - FM_ANON_LIMIT=20     # Max different files per IP within the time window
  - FM_ANON_IDLE_MIN=30  # Minutes of inactivity before the IP's quota deactivates and resets
```

- Repeated access to the same file and resume requests don't count as new accesses; returning `429` when the limit of different files is reached.
- After `FM_ANON_IDLE_MIN` minutes of inactivity, the IP's quota deactivates and resets.

### Share Direct Links (Custom Views & Expiry)

When authentication is enabled, logged-in admins can generate signed share links for individual files from the "Share" dialog, with custom settings:

- View count: 0 = unlimited, link expires after reaching the limit.
- Expiry (hours): 0 = permanent, link expires after the timeout.

Links look like `/__fm/s?t=<signed-token>`, accessible without login; token is HMAC-signed and tamper-proof, expiry is guaranteed by the signature and survives server restarts (view count is in-memory and resets on restart).

### WebDAV

winFM supports WebDAV in both directions:

**1. As a WebDAV server (let other clients mount this data directory)**

The server endpoint is fixed at `/__dav/`, exposing the data directory over WebDAV. Client address looks like:

```
http://your-host:8888/__dav/
```

- Auth: reuses the admin account via HTTP Basic auth (same username/password as login). No auth in `FM_OPEN=1` open mode.
- Supported methods: `OPTIONS / PROPFIND / GET / HEAD / PUT / DELETE / MKCOL / COPY / MOVE / LOCK / UNLOCK / PROPPATCH`, covering common clients (Windows mapped network drive, macOS Finder "Connect to Server", RaiDrive, mobile file apps, etc.).
- Security: internal config files (`.fm-auth.json`, `.fm-mounts.json`, etc.) are hidden from WebDAV listings and cannot be accessed directly.

**2. As a WebDAV client (mount other WebDAV servers)**

In the sidebar "WebDAV Mounts", click "Add mount", fill in a name, the remote address (`http(s)://...`), and optional username/password. You can then browse, upload, download, create, rename and delete remote files right inside the winFM UI, just like a local directory.

- Mount config is persisted in `.fm-mounts.json` in the data directory (contains remote credentials, file mode `0600`, hidden and not accessible).
- Inside a mount, the breadcrumb is rooted at the mount; move/copy currently works only within the same mount (cross-storage move/copy between local and remote is not supported yet).
- Mount management and browsing require admin login.

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
- **Dependencies**: busboy (streaming upload parsing), sharp (image thumbnails), ffmpeg (video frame extraction)
- **UI Components**: Material Web (Material Design 3, bundled locally, no CDN dependency)
- **Icons**: Material Symbols (bundled font subset)
- **Styles**: Material Design 3 design tokens (native CSS, no build step at runtime)
- **Transport**: HTML gzip compression, static asset caching, file ETag/304, Range resume

## 📁 Supported File Types

| Type | Extensions |
|------|-----------|
| Images | PNG, JPG, JPEG, GIF, SVG, WebP, AVIF, BMP, TIFF, ICO |
| Video | MP4, WebM, MKV, MOV, M4V |
| Audio | MP3, WAV, OGG, AAC, FLAC, M4A, WMA, OPUS |
| Documents | PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, CSV |
| Archives | ZIP, RAR, 7Z, TAR, GZ, TGZ, BZ2, XZ, ZST |
| Code | HTML, CSS, JS, TS, JSX, TSX, Vue, Svelte, Python, Java, C/C++, Go, Rust, Ruby, PHP, Swift, Kotlin, etc. |
| Other | TXT, MD, YAML, TOML, XML, LOG, Shell scripts, Font files |

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
