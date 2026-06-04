FROM node:20-alpine
RUN apk add --no-cache zip
WORKDIR /app
COPY file-manager.js .
RUN mkdir -p /data
EXPOSE 8888
CMD ["node", "file-manager.js"]
