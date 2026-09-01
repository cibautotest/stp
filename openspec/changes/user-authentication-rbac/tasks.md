# 用户认证与RBAC权限系统 - 实施任务

## 1. 数据库层

- [ ] 1.1 在 `init.sql` 中新增 `users` 表（含 `/* 变更: 2026-05-21 - 新增用户系统 */` 注释）
- [ ] 1.2 在 `init.sql` 中新增 `user_projects` 表（含 `/* 变更: 2026-05-21 - 新增用户项目权限 */` 注释）
- [ ] 1.3 在 `init.sql` 中新增 sysadmin 初始数据（含 `/* 变更: 2026-05-21 - 初始管理员账号 */` 注释）
- [ ] 1.4 手动在远程 DBeaver 执行新增的 SQL 建表

## 2. 后端依赖与配置

- [ ] 2.1 在 `platform-service/pom.xml` 增加 `spring-boot-starter-security`、`jjwt-api`、`jjwt-impl`、`jjwt-jackson`
- [ ] 2.2 在 `platform-service/application.yml` 增加 `jwt.secret` 配置项

## 3. 后端 - 安全层 (security 包)

- [ ] 3.1 创建 `JwtUtil.java` - JWT 生成/解析/验证工具类
- [ ] 3.2 创建 `JwtAuthenticationFilter.java` - 从 Header 提取 Token 并设置 SecurityContext
- [ ] 3.3 创建 `SecurityConfig.java` - Spring Security 配置，白名单 + JWT 过滤器
- [ ] 3.4 创建 `UserDetailsServiceImpl.java` - 加载用户信息

## 4. 后端 - 实体与数据层

- [ ] 4.1 创建 `User.java` 实体
- [ ] 4.2 创建 `UserProject.java` 实体
- [ ] 4.3 创建 `UserMapper.java` Mapper
- [ ] 4.4 创建 `UserProjectMapper.java` Mapper

## 5. 后端 - 认证与用户服务

- [ ] 5.1 创建 `AuthService.java` - 登录认证逻辑
- [ ] 5.2 创建 `UserService.java` - 用户 CRUD + 项目权限管理

## 6. 后端 - 认证与用户 Controller

- [ ] 6.1 创建 `AuthController.java` - POST /auth/login, GET /auth/me
- [ ] 6.2 创建 `UserController.java` - 用户 CRUD + 项目权限 CRUD (仅 sysadmin)

## 7. 后端 - 改造已有 API 数据过滤

- [ ] 7.1 修改 `ProjectService.list()` - 根据角色和用户项目关联过滤
- [ ] 7.2 修改 `TestCaseService.list()` - 校验用户是否有权限访问该 projectId
- [ ] 7.3 修改 `ReportService.list()` - 仅返回有权限项目的报告
- [ ] 7.4 首页统计类接口也加上项目权限过滤

## 8. 前端 - 认证相关

- [ ] 8.1 创建 `views/login/index.vue` - 登录页（Element Plus 表单）
- [ ] 8.2 创建 `stores/auth.ts` - token + 用户信息管理
- [ ] 8.3 修改 `api/axios.ts` - 请求拦截器添加 `Authorization: Bearer <token>`
- [ ] 8.4 修改 `router/index.ts` - 添加 login 路由 + 路由守卫
- [ ] 8.5 修改 `App.vue` - 初始化时从 localStorage 恢复 token 并获取用户信息

## 9. 前端 - 用户管理页

- [ ] 9.1 创建 `views/users/index.vue` - 用户列表 + 创建用户弹窗
- [ ] 9.2 创建用户/编辑用户表单（用户名、密码、角色、状态）
- [ ] 9.3 项目权限分配弹窗（多选项目列表）
- [ ] 9.4 仅在 sysadmin 角色下显示该页面入口

## 10. 前端 - 权限改造

- [ ] 10.1 修改 `MainLayout.vue` - 侧边栏根据角色显示/隐藏 Config 和 Users 入口
- [ ] 10.2 修改 `MainLayout.vue` - 顶部栏显示当前用户名 + 退出登录按钮
- [ ] 10.3 修改 `views/home/index.vue` - 统计面板只计算有权限项目的数据
- [ ] 10.4 修改 `views/cases/index.vue` - 项目下拉框只显示有权限的项目
- [ ] 10.5 修改 `views/config/index.vue` - 非 sysadmin 隐藏或禁用

## 11. 验证

- [ ] 11.1 验证未登录访问 → 重定向登录页
- [ ] 11.2 验证 sysadmin 登录 → 可见所有项目
- [ ] 11.3 验证 general 登录 + 未分配项目 → 空列表
- [ ] 11.4 验证 general 登录 + 分配项目 → 仅可见分配的项目
- [ ] 11.5 验证回调接口 `/callback/execution-result` → 无需 token
- [ ] 11.6 验证用户管理 → 创建/编辑/分配权限正确
- [ ] 11.7 退出登录 → token 清除 → 再次访问需重新登录
