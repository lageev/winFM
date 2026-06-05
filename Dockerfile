FROM node:20-alpine
WORKDIR /app
COPY file-manager.js .
COPY src/ ./src/
RUN mkdir -p /data
EXPOSE 8888
CMD ["node", "file-manager.js"]
