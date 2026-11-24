---
name: stp-deploy
description: 智能测试中台（STP）服务器部署 SOP。当用户要求部署、发布、上线、打包到服务器（10.3.71.x）或同步本地改动到测试/生产环境时使用。覆盖后端 jar、前端 dist、execute-service dist、Chrome 插件四类产物的构建、上传、重启与验收。
metadata:
  author: stp-team
  version: "1.0"
---

# STP 服务器部署 SOP

## 第一步：确定部署范围（改动层 → 产物对照表）

| 本次改动涉及 | 必须重新部署 | 构建命令 |
|---|---|---|
| backend/ 任意 java | platform-service jar（eureka/gateway 通常不动） | `cd backend; mvn -pl platform-service -am package -DskipTests` |
| backend SQL 迁移（V*.sql） | 服务器 DB 执行迁移脚本 | 去 BOM 后在服务器 MySQL 执行 |
| frontend/src | 前端 dist | `cd frontend; npm run build` |
| execute-service/src | execute-service dist + node_modules 生产依赖 | `cd execute-service; npm run build` |
| 测试用例可视化插件-v1.92/ | 插件目录 zip（用户手动加载 unpacked 或重新打包） | 压缩整个插件目录 |

不确定改了哪些层时：先 `git status` / `git diff --stat` 或询问用户，**不要全量部署**。

## 第二步：构建前验证（本地必过）

- 后端：`cd backend; mvn -q -pl platform-service -am compile -DskipTests` 退出码 0
- 执行引擎：`cd execute-service; npx tsc` 退出码 0
- 前端：改动文件 `read_lints` 零错误
- SQL：新迁移文件**必须去 BOM**（node 脚本去 BOM 后再分发，BOM 会导致 mysql source 语法错误）

## 第三步：构建产物

按上表命令构建。产物位置：
- 后端 jar：`backend/platform-service/target/*.jar`
- 前端：`frontend/dist/`
- 执行引擎：`execute-service/dist/`（部署时服务器需 `npm install --omit=dev` 或随包带 node_modules）
- 插件：整个 `测试用例可视化插件-v1.92/` 目录

## 第四步：上传与重启

1. 上传前与用户确认服务器地址/路径/凭据（默认 10.3.71.x，**不要假设凭据**）；
2. 上传产物到对应目录；
3. 重启顺序：platform-service → execute-service →（前端静态资源无需进程重启，nginx/静态服务直接生效）；
4. DB 迁移在重启 platform-service **之前**执行。

## 第五步：部署后验收（缺一不可）

- 端口健康：`curl http://<server>:8081/doc.html`（API 文档可达）、`curl http://<server>:3001/health`
- 登录冒烟：`POST /api/platform/auth/login`（sysadmin）返回 token
- 本次改动功能的 API 级冒烟（参照 stp-e2e-verify 技能的步骤）
- 提醒用户：Chrome 插件需在 chrome://extensions 重新加载

## 红线

- 服务器操作（上传/重启/改配置）**必须先获得用户明确指令与凭据**，不主动连服务器；
- 生产环境禁止携带本地 `.env` 的明文密钥，用服务器环境变量注入；
- 部署失败回滚：保留上一版产物副本，先恢复再排查。
