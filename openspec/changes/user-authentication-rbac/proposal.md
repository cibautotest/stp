## Why

当前智能测试中台**完全没有认证与授权机制**，任何人都可以直接访问所有 API 和数据。随着平台需要在多项目、多用户场景下使用，面临以下核心问题：

- **数据安全风险**：所有用户都能看到全量项目的测试用例和报告
- **无法多用户协作**：不同用户无法按权限隔离，只能共用账号
- **缺乏审计能力**：无法追溯"谁做了什么"
- **管理成本高**：项目多了以后，缺乏用户→项目的权限分配手段

通过引入 RBAC（基于角色的访问控制），实现用户登录、角色权限隔离、用户-项目关联，让不同用户仅能看到自己有权限的项目的数据。

## What Changes

### 新增能力

- **用户认证**：JWT Token 登录，密码 BCrypt 加密存储
- **用户管理**：sysadmin 可在界面中创建/管理用户、分配或移除项目权限
- **角色权限**：`sysadmin`（全量可见）与 `general`（仅关联项目可见）双角色
- **鉴权中间件**：所有业务 API 需携带有效 Token（白名单除外）
- **权限数据过滤**：列表查询按角色自动过滤 project_id 范围

### 新增页面

- **登录页**：用户名/密码表单，登录后跳转首页
- **用户管理页**（仅 sysadmin 可见）：创建用户、分配角色、管理项目权限

### 新增数据库表

- **`users`** 用户表
- **`user_projects`** 用户-项目关联表

### 受影响代码

| 模块 | 改动说明 |
|------|---------|
| **backend/pom.xml** | 新增 `spring-boot-starter-security` + `jjwt` 依赖 |
| **backend/platform-service** | 新增 `security/` 包（JWT 工具、过滤器、Security 配置） |
| **backend/platform-service** | 新增 `User`/`UserProject` 实体、Mapper、Service、Controller |
| **backend/platform-service** | 修改 `ProjectController`/`TestCaseController`/`ReportController` 数据过滤 |
| **backend/platform-service** | 修改 `init.sql` 新增 users + user_projects 表 |
| **frontend** | 新增登录页、用户管理页、auth store、路由守卫 |
| **frontend** | 修改 axios 拦截器、MainLayout、首页/用例/报告列表权限过滤 |

### 不受影响

- ❌ 不修改 `execute-service`（Node.js 执行引擎）—— 回调已加入白名单
- ❌ 不修改 Eureka、Gateway 的现有配置
- ❌ 不修改现有的数据库表结构（仅新增表）
- ❌ 不涉及 SSO、OAuth2、LDAP 等外部认证集成

## Capabilities

### New Capabilities

- `user-authentication`: 用户登录认证 - JWT + BCrypt 登录认证
- `user-management`: 用户管理 - sysadmin 创建/管理用户及项目权限
- `rbac-data-filter`: 权限数据过滤 - 按角色和项目关联自动过滤数据

### Modified Capabilities

- `project-management`: 项目列表根据用户权限过滤
- `test-case-management`: 用例列表根据用户项目权限过滤
- `report-management`: 报告列表根据用户项目权限过滤

## Impact

### 新增目录

```
backend/platform-service/src/main/java/com/smarttesting/platform/
├── security/
│   ├── JwtUtil.java                # JWT 工具类
│   ├── JwtAuthenticationFilter.java # JWT 鉴权过滤器
│   ├── SecurityConfig.java         # Spring Security 配置
│   └── UserDetailsServiceImpl.java  # 用户加载
└── controller/
    ├── AuthController.java          # 登录/获取当前用户
    └── UserController.java          # 用户管理 CRUD

frontend/src/
├── views/login/index.vue           # 登录页
├── views/users/index.vue           # 用户管理页 (sysadmin)
└── stores/auth.ts                  # 认证状态管理
```

### API 变更

| 方法 | 路径 | 变更 |
|------|------|------|
| POST | `/api/platform/auth/login` | **新增** - 登录，返回 token |
| GET | `/api/platform/auth/me` | **新增** - 获取当前用户信息 |
| POST | `/api/platform/auth/logout` | **新增** - 登出 |
| GET | `/api/platform/users` | **新增** - 用户列表 (仅 sysadmin) |
| POST | `/api/platform/users` | **新增** - 创建用户 (仅 sysadmin) |
| PUT | `/api/platform/users/{id}` | **新增** - 更新用户 (仅 sysadmin) |
| DELETE | `/api/platform/users/{id}` | **新增** - 删除用户 (仅 sysadmin) |
| GET | `/api/platform/users/{id}/projects` | **新增** - 查询用户关联项目 |
| POST | `/api/platform/users/{id}/projects` | **新增** - 分配项目权限 |
| DELETE | `/api/platform/users/{id}/projects/{projectId}` | **新增** - 移除项目权限 |
| GET | `/api/platform/projects` | **修改** - 根据角色过滤项目列表 |
| GET | `/api/platform/cases?projectId=xxx` | **修改** - 校验用户是否有权限访问该 projectId |
| GET | `/api/platform/reports` | **修改** - 仅返回有权限项目的报告 |
| POST | `/api/platform/callback/execution-result` | **白名单** - 无需认证 |

### 依赖项新增

```xml
<!-- platform-service/pom.xml -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-api</artifactId>
    <version>0.12.6</version>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-impl</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt-jackson</artifactId>
    <version>0.12.6</version>
    <scope>runtime</scope>
</dependency>
```
