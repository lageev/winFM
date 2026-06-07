# Docker 镜像构建和推送脚本 (PowerShell)
param(
    [string]$Username = $env:DOCKER_USERNAME,
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

# 配置
if (-not $Username) {
    $Username = Read-Host "请输入 Docker Hub 用户名"
}

$ImageName = "winfm"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Docker 镜像构建和推送脚本" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "用户名: $Username" -ForegroundColor Yellow
Write-Host "镜像名: $ImageName" -ForegroundColor Yellow
Write-Host "版本:   $Version" -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

# 检查是否登录 Docker Hub
Write-Host "1. 检查 Docker Hub 登录状态..." -ForegroundColor Green
try {
    docker info 2>&1 | Select-String "Username" | Out-Null
    Write-Host "   ✓ 已登录 Docker Hub" -ForegroundColor Green
} catch {
    Write-Host "   请先登录 Docker Hub:" -ForegroundColor Yellow
    docker login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "   ✗ 登录失败" -ForegroundColor Red
        exit 1
    }
}

# 构建镜像
Write-Host "2. 构建 Docker 镜像..." -ForegroundColor Green
docker build -t "${ImageName}:latest" .
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ 构建失败" -ForegroundColor Red
    exit 1
}
Write-Host "   ✓ 构建完成" -ForegroundColor Green

# 标签镜像
Write-Host "3. 标签镜像..." -ForegroundColor Green
docker tag "${ImageName}:latest" "${Username}/${ImageName}:latest"
docker tag "${ImageName}:latest" "${Username}/${ImageName}:${Version}"
Write-Host "   ✓ 标签完成" -ForegroundColor Green

# 推送镜像
Write-Host "4. 推送镜像到 Docker Hub..." -ForegroundColor Green
docker push "${Username}/${ImageName}:latest"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ 推送 latest 失败" -ForegroundColor Red
    exit 1
}

docker push "${Username}/${ImageName}:${Version}"
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ✗ 推送 ${Version} 失败" -ForegroundColor Red
    exit 1
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "✅ 镜像推送完成！" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "拉取命令:" -ForegroundColor Yellow
Write-Host "  docker pull ${Username}/${ImageName}:latest" -ForegroundColor White
Write-Host "  docker pull ${Username}/${ImageName}:${Version}" -ForegroundColor White
Write-Host ""
Write-Host "运行命令:" -ForegroundColor Yellow
Write-Host "  docker run -d -p 8888:8888 -v /your/local/path:/data ${Username}/${ImageName}:latest" -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Cyan