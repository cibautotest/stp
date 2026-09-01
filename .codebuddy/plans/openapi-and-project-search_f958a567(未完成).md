---
name: openapi-and-project-search
overview: 1. 启用 Knife4j (OpenAPI3) 接口文档，为所有 Controller 添加 Swagger 注解，配置 Gateway 路由暴露文档页面。2. 为项目模块添加按名称模糊搜索的列表查询功能。
todos:
  - id: knife4j-config
    content: 创建 Knife4jConfig 配置类并在 application.yml 中启用 springdoc + knife4j
    status: pending
  - id: entity-schema
    content: 为 4 个 Entity 类添加 @Schema 字段描述注解
    status: pending
  - id: controller-swagger
    content: 为 5 个 Controller 添加 @Tag/@Operation/@Parameter Swagger 注解
    status: pending
    dependencies:
      - knife4j-config
  - id: project-name-search
    content: 为 ProjectController.list() 新增 name 查询参数，并在 ProjectService 添加 listByName 模糊搜索方法
    status: pending
  - id: gateway-doc-routes
    content: 在 Gateway application.yml 新增 /v3/api-docs/**、/doc.html、/webjars/** 三条文档路由
    status: pending
    dependencies:
      - knife4j-config
---

## 用户需求

1. **后端接入 OpenAPI 接口文档**：为 platform-service 的 5 个 Controller 全面启用 Knife4j 接口文档，通过 Gateway 统一入口访问 `http://localhost:8080/doc.html`
2. **项目模块添加列表查询**：ProjectController 的列表接口支持按名称（`name` 参数）模糊搜索，不再仅返回全量数据

## 核心功能

- **OpenAPI 文档可视化**：在 `config/` 目录创建 Knife4j 配置类，在 application.yml 启用 springdoc + knife4j，为全部 5 个 Controller 添加 `@Tag`/`@Operation`/`@Parameter` 注解，为 4 个 Entity 添加 `@Schema` 字段描述
- **Gateway 文档路由**：Gateway 新增 `/v3/api-docs/**`、`/doc.html`、`/webjars/**` 三条路由，将文档请求转发至 platform-service
- **项目名称搜索**：`GET /api/platform/projects?name=xxx` 支持按项目名称模糊匹配（MyBatis-Plus `LambdaQueryWrapper.like`），不传 `name` 时保持原有全量返回行为

## 技术栈

- **Spring Boot 2.7.18** + **Spring Cloud 2021.0.9** + Java 11
- **MyBatis-Plus 3.5.3.1**：ORM 层，Service 继承 `ServiceImpl`，Mapper 继承 `BaseMapper`
- **Knife4j 4.3.0** (OpenAPI 3 规范)：依赖已存在于 `pom.xml`，本方案仅激活配置和添加注解
- 文档 UI 访问入口：`http://localhost:8080/doc.html`

## 实现方案

### 1. Knife4j 接入（激活现有依赖）

**策略**：Knife4j 4.3.0 使用 OpenAPI 3 规范，底层通过 springdoc-openapi 自动扫描。只需创建一个配置类 + yml 配置 + 注解即可激活，无需额外依赖。

**Knife4jConfig.java 配置类**：

- 使用 `@Configuration` 声明
- 创建 `@Bean GroupedOpenApi` 分组 API 文档，group 为 `"platform-service"`
- 配置扫描路径为 `com.smarttesting.platform.controller`
- 创建 `@Bean OpenAPI` 定义文档标题、版本、描述

**application.yml 新增配置段**：

```
springdoc:
  swagger-ui:
    path: /swagger-ui.html
  api-docs:
    path: /v3/api-docs
  group-configs:
    - group: 'platform-service'
      paths-to-match: '/**'

knife4j:
  enable: true
  setting:
    language: zh_cn
```

**Controller 注解模式**：

- 类级别：`@Tag(name = "项目管理", description = "项目 CRUD 接口")`
- 方法级别：`@Operation(summary = "获取项目列表")`
- 参数级别：`@Parameter(description = "项目名称（支持模糊搜索）")` 用于 name 筛选参数

**Entity 注解模式**：

- 类级别不需要注解
- 关键字段添加 `@Schema(description = "项目名称")`

### 2. Gateway 文档路由

Gateway 需新增三条路由，**放在兼容路由之前**（优先级更高）：

```
# OpenAPI 文档路由
- id: platform-api-docs
  uri: lb://platform-service
  predicates:
    - Path=/v3/api-docs/**
  filters:
    - StripPrefix=0

- id: platform-doc-html
  uri: lb://platform-service
  predicates:
    - Path=/doc.html
  filters:
    - StripPrefix=0

- id: platform-webjars
  uri: lb://platform-service
  predicates:
    - Path=/webjars/**
  filters:
    - StripPrefix=0
```

Gateway 不需要额外依赖（不引入 springdoc-openapi-webflux，纯路由转发即可）。

### 3. Project 名称搜索

**ProjectController.list() 改动**：

```java
@GetMapping
@Operation(summary = "获取项目列表")
public ResponseEntity<List<Project>> list(
    @Parameter(description = "项目名称（支持模糊搜索）")
    @RequestParam(required = false) String name) {
    if (name != null && !name.isBlank()) {
        return ResponseEntity.ok(projectService.listByName(name));
    }
    return ResponseEntity.ok(projectService.list());
}
```

**ProjectService.listByName() 新增**：

```java
public List<Project> listByName(String name) {
    return lambdaQuery()
        .like(Project::getName, name)
        .list();
}
```

利用 MyBatis-Plus 的 `LambdaQueryWrapper.like()` 实现 `WHERE name LIKE '%xxx%'`，逻辑删除由 `@TableLogic` 自动过滤。

## 实现说明

- **无性能问题**：`like` 查询在 MySQL 的 `name` 字段上已有 UNIQUE 索引，模糊搜索走索引前缀匹配，数据量小时无感知
- **向后兼容**：`name` 参数为 `required=false`，不传时行为与原来完全一致
- **日志无影响**：注解仅在编译期有效，运行时不产生额外日志
- **Gateway 路由冲突处理**：文档路由的 `Path=/v3/api-docs/**` 等与现有 API 路由不冲突，放在最前面确保优先匹配

## 目录结构

```
backend/
├── gateway-service/src/main/resources/
│   └── application.yml                          # [MODIFY] 新增 3 条 OpenAPI 路由
└── platform-service/src/main/
    ├── resources/
    │   └── application.yml                      # [MODIFY] 新增 springdoc + knife4j 配置
    └── java/com/smarttesting/platform/
        ├── config/
        │   └── Knife4jConfig.java               # [NEW] OpenAPI 文档配置类
        ├── controller/
        │   ├── ProjectController.java           # [MODIFY] +@Tag/@Operation/@Parameter, list() +name参数
        │   ├── TestCaseController.java          # [MODIFY] +@Tag/@Operation/@Parameter
        │   ├── AiConfigController.java           # [MODIFY] +@Tag/@Operation
        │   ├── ReportController.java             # [MODIFY] +@Tag/@Operation/@Parameter
        │   └── ExecutionCallbackController.java  # [MODIFY] +@Tag/@Operation
        ├── entity/
        │   ├── Project.java                     # [MODIFY] +@Schema 注解
        │   ├── TestCase.java                    # [MODIFY] +@Schema 注解
        │   ├── AiConfig.java                    # [MODIFY] +@Schema 注解
        │   └── Report.java                      # [MODIFY] +@Schema 注解
        └── service/
            └── ProjectService.java              # [MODIFY] +listByName(name) 方法
```