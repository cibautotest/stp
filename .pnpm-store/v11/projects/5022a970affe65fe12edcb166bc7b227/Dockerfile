# 使用本地已生成的 dist 目录，仅构建 Nginx 运行镜像。
FROM nginx:1.27-alpine
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY dist /usr/share/nginx/html
ENV BACKEND_GATEWAY_URL=http://host.docker.internal:8080
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
