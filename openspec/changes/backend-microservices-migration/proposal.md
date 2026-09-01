## Why

当前智能测试中台后端采用 Express 单体架构，随着业务发展面临以下挑战：
- **可扩展性受限**：所有功能耦合在单一服务中，无法独立扩展执行引擎
- **技术栈不一致**：Java 业务逻辑与 Node.js 混合维护，增加运维复杂度
- **团队协作困难**：无法按领域独立开发和部署

通过微服务架构改造，实现业务逻辑（Java/SpringCloud）与执行引擎（Node.js/Midscene）的解耦，提升系统的可扩展性、可维护性和团队协作效率。

## What Changes

### 新增
- **SpringCloud 微服务体系**：基于 Eureka 的服务注册与发现
- **API 网关服务**：统一路由、鉴权、限流
- **平台业务服务**：处理项目管理、用例管理、配置管理等核心业务
- **Node.js 执行引擎服务**：独立部署的 Midscene 测试执行引擎
- **MySQL 数据库**：支持业务数据的持久化存储
- **MyBatis-Plus 集成**：简化数据访问层开发

### 迁移
- **Express API 迁移至 SpringBoot**：将现有的 `/api/cases`、`/api/config` 等接口迁移
- **本地文件存储迁移至数据库**：用例数据从 JSON 文件迁移至 MySQL
- **脚本生成逻辑迁移**：YAML 脚本生成逻辑保留在 Node.js 引擎

### 架构调整
- **前后端分离**：前端通过 Gateway 访问后端服务
- **服务间通信**：HTTP/RESTful + Feign Client

## Capabilities

### New Capabilities

- `service-registry`: 服务注册与发现 - Eureka 服务治理
- `api-gateway`: API 网关 - 统一路由、鉴权、限流
- `project-management`: 项目管理 - 项目的增删改查
- `test-case-management`: 测试用例管理 - 用例的 CRUD 和状态管理
- `ai-configuration`: AI 配置管理 - Midscene 模型配置
- `test-execution-engine`: 测试执行引擎 - 独立的 Node.js 执行服务
- `report-management`: 报告管理 - 测试报告的生成与存储
- `yaml-script-generation`: YAML 脚本生成 - NLP 转 YAML 任务流

### Modified Capabilities

- *(现有系统无规范文档，此为全新架构)*

## Impact

### 受影响代码
- `server/index.js` → 迁移至 SpringBoot + 独立引擎服务
- `server/data/cases.json` → 迁移至 MySQL 数据库
- `server/config/.env` → 迁移至配置中心/数据库

### 新增目录
- `backend/` - SpringCloud 微服务根目录
- `backend/eureka-server/` - 服务注册中心
- `backend/gateway-service/` - API 网关
- `backend/platform-service/` - 平台业务服务
- `engine-service/` - Node.js 执行引擎（独立部署）

### API 变更
- 所有 API 通过 Gateway 统一暴露
- 执行引擎 API 仅供内部服务调用
- 保留向后兼容的接口路径

### 依赖项
- JDK 11+
- Maven 3.8+
- MySQL 8.0
- Node.js 18+
