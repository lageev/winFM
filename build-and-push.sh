#!/bin/bash
set -e

# 配置 - 请修改为你的 Docker Hub 用户名
DOCKER_USERNAME="${DOCKER_USERNAME:-yourusername}"
IMAGE_NAME="winfm"
VERSION="${VERSION:-1.0.0}"

echo "=========================================="
echo "Docker 镜像构建和推送脚本"
echo "=========================================="
echo "用户名: $DOCKER_USERNAME"
echo "镜像名: $IMAGE_NAME"
echo "版本:   $VERSION"
echo "=========================================="

# 检查是否登录 Docker Hub
if ! docker info 2>/dev/null | grep -q "Username"; then
    echo "请先登录 Docker Hub:"
    docker login
fi

echo "1. 构建 Docker 镜像..."
docker build -t $IMAGE_NAME:latest .

echo "2. 标签镜像..."
docker tag $IMAGE_NAME:latest $DOCKER_USERNAME/$IMAGE_NAME:latest
docker tag $IMAGE_NAME:latest $DOCKER_USERNAME/$IMAGE_NAME:$VERSION

echo "3. 推送镜像到 Docker Hub..."
docker push $DOCKER_USERNAME/$IMAGE_NAME:latest
docker push $DOCKER_USERNAME/$IMAGE_NAME:$VERSION

echo "=========================================="
echo "✅ 镜像推送完成！"
echo "=========================================="
echo "拉取命令:"
echo "  docker pull $DOCKER_USERNAME/$IMAGE_NAME:latest"
echo "  docker pull $DOCKER_USERNAME/$IMAGE_NAME:$VERSION"
echo ""
echo "运行命令:"
echo "  docker run -d -p 8888:8888 -v /your/local/path:/data $DOCKER_USERNAME/$IMAGE_NAME:latest"
echo "=========================================="