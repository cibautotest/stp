# 后端微服务架构迁移实施任务

## 1. 项目结构搭建

- [x] 1.1 创建 Maven 多模块项目结构 (backend/parent-pom)
- [x] 1.2 配置父 pom.xml (SpringBoot 2.7.x, SpringCloud 2021.0.x)
- [x] 1.3 创建子模块目录结构 (eureka-server, gateway-service, platform-service)
- [x] 1.4 创建 engine-service (Node.js) 目录结构
- [x] 1.5 配置各模块的 pom.xml 依赖

## 2. Eureka 服务注册中心

- [x] 2.1 创建 eureka-server 模块
- [x] 2.2 配置 application.yml (端口 8761, 禁用自我注册)
- [x] 2.3 添加 @EnableEurekaServer 注解
- [x] 2.4 验证 Eureka Dashboard 访问

## 3. API 网关服务

- [x] 3.1 创建 gateway-service 模块
- [x] 3.2 配置 application.yml (端口 8080, 路由规则)
- [x] 3.3 配置到 platform-service (/api/platform/**) 的路由
- [x] 3.4 配置到 engine-service (/api/engine/**) 的路由
- [x] 3.5 添加健康检查端点配置
- [x] 3.6 验证网关路由功能

## 4. Platform 业务服务 - 数据层

- [x] 4.1 创建 platform-service 模块
- [x] 4.2 配置 application.yml (端口 8081, 数据库连接)
- [x] 4.3 创建数据库表 (projects, test_cases, ai_config, reports)
- [x] 4.4 创建 MyBatis-Plus 实体类 (Project, TestCase, AiConfig, Report)
- [x] 4.5 创建 Mapper 接口
- [x] 4.6 配置 MyBatis-Plus 分页插件

## 5. Platform 业务服务 - API 实现

- [x] 5.1 实现 Project Controller (CRUD API)
- [x] 5.2 实现 Project Service (业务逻辑)
- [x] 5.3 实现 TestCase Controller (CRUD API)
- [x] 5.4 实现 TestCase Service (业务逻辑)
- [x] 5.5 实现 AiConfig Controller (配置管理 API)
- [x] 5.6 实现 AiConfig Service (业务逻辑)
- [x] 5.7 实现 Report Controller (报告查询 API)
- [x] 5.8 实现 Report Service (业务逻辑)
- [x] 5.9 添加服务注册到 Eureka
- [x] 5.10 验证所有 API 端点

## 6. YAML 脚本生成服务

- [x] 6.1 创建 YamlGeneratorService
- [x] 6.2 实现 NLP 到 YAML 转换逻辑
- [x] 6.3 实现 URL 提取逻辑
- [x] 6.4 实现 YAML 格式验证
- [x] 6.5 支持多种任务类型 (ai, aiQuery, aiString, sleep)

## 7. Engine 执行引擎 (Node.js)

- [x] 7.1 初始化 engine-service 项目 (package.json, tsconfig.json)
- [x] 7.2 实现任务接收 API (/api/engine/execute)
- [x] 7.3 实现任务状态查询 API (/api/engine/status/{taskId})
- [x] 7.4 实现任务取消 API (/api/engine/task/{taskId})
- [x] 7.5 实现 SSE 日志推送 (/sse/logs/{taskId})
- [x] 7.6 实现 Midscene 脚本执行逻辑 (从 server/index.js 迁移)
- [x] 7.7 集成 Chromium 浏览器路径检测
- [x] 7.8 添加健康检查端点 (/api/engine/health)
- [x] 7.9 验证与 Platform 服务的通信

## 8. 服务间通信

- [x] 8.1 在 Platform 服务添加 Feign Client (EngineClient)
- [x] 8.2 实现执行任务触发 (调用 Engine 服务)
- [x] 8.3 实现执行结果回调 (Engine → Platform)
- [x] 8.4 处理服务不可用场景 (Fallback)

## 9. 数据迁移

- [x] 9.1 创建数据迁移脚本 (cases.json → MySQL)
- [x] 9.2 迁移测试用例数据
- [x] 9.3 迁移 AI 配置数据
- [x] 9.4 验证数据完整性

## 10. 前端适配

- [x] 10.1 更新前端 API 基础路径 (localhost:3001 → localhost:8080)
- [x] 10.2 验证项目管理功能
- [x] 10.3 验证用例管理功能
- [x] 10.4 验证测试执行功能
- [x] 10.5 验证报告查看功能

## 11. 部署配置

- [x] 11.1 创建 docker-compose.yml (MySQL, Eureka, Gateway, Platform, Engine)
- [x] 11.2 创建 Dockerfile.eureka
- [x] 11.3 创建 Dockerfile.gateway
- [x] 11.4 创建 Dockerfile.platform
- [x] 11.5 创建 Dockerfile.engine
- [x] 11.6 创建启动脚本 (start.sh, start.bat)
- [x] 11.7 验证 Docker 部署

## 12. 文档与验收

- [x] 12.1 更新 README.md (架构说明, 快速开始)
- [x] 12.2 更新 API 文档
- [x] 12.3 创建数据库设计文档
- [x] 12.4 执行集成测试
- [x] 12.5 验证所有规范中的场景
