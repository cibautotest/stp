## Context

### 背景
智能测试中台是一个基于 UI 视觉识别的自动化测试平台，当前使用 Express (Node.js) 单体架构处理所有业务逻辑，包括：
- 测试项目管理
- 测试用例管理
- Midscene YAML 脚本生成
- 测试执行与报告生成

### 当前痛点
1. **执行引擎耦合**：Midscene 测试执行依赖 Node.js 环境，但业务逻辑也在 Node.js 中，无法独立扩展
2. **技术栈混乱**：Java 与 Node.js 混用，增加维护成本
3. **扩展性差**：无法针对执行密集型任务单独扩展
4. **团队协作受限**：无法按领域独立开发和部署

### 约束条件
- 保留 Node.js 执行引擎（Midscene 强依赖）
- 业务逻辑迁移至 Java/SpringCloud
- 保持前端 API 调用方式兼容
- 支持本地开发和 Docker 部署

## Goals / Non-Goals

**Goals:**
- 实现 SpringCloud 微服务架构
- 将业务逻辑与执行引擎解耦
- 建立统一的服务注册与发现机制
- 提供标准化的 API 网关
- 保持向后兼容的 API 接口

**Non-Goals:**
- 不迁移前端代码
- 不实现完整的 CI/CD 流水线
- 不使用 Kubernetes 容器编排
- 不实现微服务熔断/降级（第一阶段）

## Decisions

### D1: 微服务划分

| 服务 | 技术栈 | 职责 |
|------|--------|------|
| `eureka-server` | SpringBoot 2.x + Eureka Server | 服务注册与发现 |
| `gateway-service` | SpringCloud Gateway | API 路由、鉴权、限流 |
| `platform-service` | SpringBoot 2.x + MyBatis-Plus | 业务逻辑、数据持久化 |
| `engine-service` | Node.js + Express | Midscene 测试执行引擎 |

**决策理由**：
- 平台服务与执行引擎解耦，可独立部署和扩展
- Gateway 统一入口，便于前端对接和安全控制
- Eureka 作为服务治理基础设施，支持服务健康检查

**替代方案**：
- Consul/Nacos 作为注册中心 → 放弃，因项目规模不需要
- 全部 Java 实现 → 放弃，Midscene 必须 Node.js

### D2: 数据库选型

**选择**: MySQL 8.0 + MyBatis-Plus

**决策理由**：
- MySQL 是成熟的关系型数据库，运维成本低
- MyBatis-Plus 简化 CRUD 操作，减少样板代码
- 现有 Express 使用 JSON 文件存储，迁移至 MySQL 提升数据一致性

### D3: 服务间通信

**选择**: RESTful + Feign Client

**决策理由**：
- 简单直接，调试方便
- Feign 声明式 HTTP 客户端简化服务调用
- 支持负载均衡和熔断（结合 Ribbon/Hystrix）

### D4: 执行引擎保留 Node.js

**决策理由**：
- Midscene 基于 Playwright，强依赖 Node.js 环境
- Node.js 事件驱动模型适合 I/O 密集型的脚本执行
- 保持脚本生成的灵活性

### D5: 端口规划

| 服务 | 端口 | 说明 |
|------|------|------|
| Gateway | 8080 | 统一 API 入口 |
| Eureka | 8761 | 服务注册中心 |
| Platform | 8081 | 业务服务 |
| Engine | 3001 | 执行引擎 |

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 服务间网络延迟增加 | 性能下降 | 使用本地 Feign 调用，合理拆分粒度 |
| 数据一致性挑战 | 事务复杂 | 第一阶段使用最终一致性，后续引入分布式事务 |
| 双技术栈维护成本 | 运维复杂度 | 统一日志格式，使用 Docker 简化部署 |
| Midscene 版本升级 | 兼容性 | Engine 服务独立隔离，影响范围可控 |

## Migration Plan

### 阶段一：基础设施搭建
1. 创建 Maven 多模块项目结构
2. 搭建 Eureka 服务注册中心
3. 配置 Gateway 网关
4. 初始化 MySQL 数据库表

### 阶段二：平台服务开发
1. 设计并实现数据模型
2. 开发项目管理 API
3. 开发用例管理 API
4. 开发配置管理 API

### 阶段三：执行引擎重构
1. 从 Express 提取执行引擎代码
2. 实现与平台服务的 REST 集成
3. 添加 SSE 日志推送支持

### 阶段四：联调与切换
1. 前后端联调
2. 数据迁移（JSON → MySQL）
3. 灰度切换流量
4. 监控告警配置

### 回滚策略
- 保留 Express 服务作为备用
- 使用 Nginx 配置快速切换回旧服务
- 数据库保留迁移前快照

## Open Questions

| 问题 | 状态 | 备注 |
|------|------|------|
| 是否需要 Redis 缓存？ | 待定 | 第一阶段不考虑 |
| 执行日志存储方案？ | 待定 | 可选：本地文件 / MongoDB / ES |
| 如何处理执行引擎水平扩展？ | 待定 | 需要分布式锁或任务队列 |
| 报告文件存储方案？ | 待定 | 可选：本地存储 / MinIO / OSS |
