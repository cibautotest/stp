## Context

### 背景

智能测试中台目前是完全开放的架构，所有 API 无需认证即可访问。前端 6 个页面（首页、创建测试、用例管理、详情、参数配置、报告中心）均无登录拦截。数据库层面也无用户/角色相关表。

### 当前痛点

1. **无访问控制**：任何人知道 URL 即可查看/修改所有项目数据
2. **无法多项目隔离**：项目 A 和项目 B 的数据对所有用户完全透明
3. **无操作审计**：无法知道"谁创建了用例、谁执行了测试"
4. **配置页面暴露**：AI 配置（含 API Key）对所有人可见

### 约束条件

- 沿用现有 Spring Boot 2.7.x + MyBatis-Plus 技术栈
- 不修改 `execute-service`（Node.js 执行引擎）的代码
- 回调接口 `/callback/*` 必须白名单放行（execute-service 无法携带 token）
- JWT Token 需在有效期内可刷新
- 密码存储使用 BCrypt 加密

## Goals / Non-Goals

**Goals:**
- 实现 JWT 登录认证
- 实现双角色 RBAC（sysadmin / general）
- 实现用户-项目权限分配（多对多关系）
- 实现数据级过滤（general 用户只看到自己有权限的项目）
- 前端新增登录页、路由守卫、用户管理页
- 所有业务 API 鉴权（白名单除外）
- 初始预置 sysadmin 账号

**Non-Goals:**
- 不做 SSO / OAuth2 / LDAP 集成
- 不做细粒度按钮级权限控制（仅到项目级别）
- 不做 token 自动刷新（过期后需重新登录）
- 不做登录重试限制和验证码
- 不做操作审计日志（仅获取当前用户信息）
- 不修改 Gateway 的代码（鉴权在 platform-service 内部完成）

## Decisions

### D1: 认证机制：JWT + Spring Security

**选择**: 使用 `spring-boot-starter-security` + `jjwt 0.12.6`，在 platform-service 内部实现认证。

**决策理由**:
- Spring Security 是 Spring Boot 生态标准认证框架，与现有技术栈一致
- JWT 无状态，适合前后端分离架构
- `jjwt 0.12.6` 是最新版活跃维护的 JWT 库，支持 Ed25519 等现代算法
- 在 platform-service 内部实现比在 Gateway 实现更简单，不影响现有路由配置

**替代方案**:
- Gateway 层鉴权 → 放弃，需改造 Gateway 代码，增加复杂度
- Session-based 认证 → 放弃，需要 Redis 存储 Session（项目明确排除 Redis）
- OAuth2 → 放弃，项目规模不需要

### D2: 角色模型：双角色 + 项目关联

```
sysadmin
├── 可见全量项目
├── 用户管理（创建/编辑/删除用户，分配权限）
├── AI 配置管理
└── 所有数据操作权限

general
├── 仅可见关联项目
├── 不可见用户管理页面
├── 不可见 AI 配置页面（或仅只读）
└── 在关联项目内的全量操作（增删改查用例、执行测试）
```

**决策理由**:
- 双角色足够满足当前"管理员 vs 普通用户"的需求
- 项目关联表 `user_projects` 灵活扩展，未来添加用户到新项目即可
- sysadmin 不插入 `user_projects`，代码层面通过 role 判断

**数据过滤逻辑**:
```
查询项目列表:
  IF role == 'sysadmin':
    → 返回所有项目（无条件）
  ELSE（general）:
    → SELECT * FROM projects WHERE id IN (
        SELECT project_id FROM user_projects WHERE user_id = ?
      )
```

### D3: Token 设计

| 参数 | 值 |
|------|-----|
| 签名算法 | HMAC-SHA256 |
| Token 有效期 | 24 小时 |
| 承载方式 | Header: `Authorization: Bearer <token>` |
| Payload | `{ sub: userId, username, role, iat, exp }` |
| 密钥 | 应用配置文件中的固定密钥（`jwt.secret`） |

### D4: 密码策略

- 使用 `BCryptPasswordEncoder`（Spring Security 内置）
- 加密强度：`10`（默认轮数）
- 不设密码复杂度规则（MVP 阶段）
- sysadmin 初始密码在 `init.sql` 中预置

### D5: 白名单路径

以下路径不需要认证：
```
POST /api/platform/auth/login          # 登录接口
POST /api/platform/callback/**         # 执行引擎回调
GET  /api/platform/auth/me              # (可选, 有 token 时返回用户信息)
/swagger-ui.html, /v3/api-docs/**      # API 文档
/actuator/health                        # 健康检查
```

### D6: 前端路由权限

```
路由:
  /login          → 所有人可访问（未登录默认跳转）
  /home           → 需要认证（sysadmin 和 general 均可）
  /create         → 需要认证（sysadmin 和 general 均可）
  /cases          → 需要认证（sysadmin 和 general 均可）
  /detail/:id     → 需要认证
  /reports        → 需要认证
  /config         → 仅 sysadmin
  /users          → 仅 sysadmin（新增）

路由守卫逻辑:
  IF 未登录 AND 目标 !== /login → 重定向 /login
  IF 已登录 AND 目标 === /login → 重定向 /home
  IF 角色为 general AND 目标 === /config OR /users → 重定向 /home（或提示无权限）
```

### D7: 鉴权过滤器位置

**选择**: 在 platform-service 的 Spring Security 配置中，通过 `SecurityFilterChain` 对所有 `/api/platform/**`（除白名单外）进行 JWT 校验。

```
请求流:
  前端 → Gateway:8080 → platform-service:8081
                              ↓
                      SecurityFilterChain
                              ↓
                      JwtAuthenticationFilter
                        (提取 Authorization header)
                        (解析 JWT, 设置 SecurityContext)
                              ↓
                      Controller (通过 @AuthenticationPrincipal 获取用户)
```

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Token 泄露 | 他人可冒充用户 | Token 有效期 24h；后续可加 IP 绑定 |
| 密码泄露 | 账号被盗 | BCrypt 加密，即使数据库泄露也无法还原密码 |
| execute-service 回调无认证 | 回调接口可能被伪造 | 先走白名单；后续可增加回调签名校验 |
| 前端 token 存储 | XSS 风险 | 存储在 localStorage；后续可改为 httpOnly Cookie |
| 初始 sysadmin 密码固定 | 部署后忘记修改 | 在初次登录时提示修改密码（后续优化） |

## DB Schema Changes

### 新增表: `users`

```sql
-- ============================================
-- 用户表 (新增 - 用户认证与授权)
-- 变更: 2026-05-21 - 新增用户系统
-- ============================================
CREATE TABLE IF NOT EXISTS `users` (
  `id`            BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username`      VARCHAR(64)  NOT NULL COMMENT '用户名 (唯一)',
  `password`      VARCHAR(256) NOT NULL COMMENT '密码 (BCrypt 加密)',
  `display_name`  VARCHAR(128) DEFAULT '' COMMENT '显示名称',
  `role`          VARCHAR(32)  NOT NULL DEFAULT 'general' COMMENT '角色: sysadmin / general',
  `status`        TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
  `last_login_at` DATETIME              COMMENT '最后登录时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `deleted`       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '逻辑删除标记',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  INDEX `idx_role` (`role`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';
```

### 新增表: `user_projects`

```sql
-- ============================================
-- 用户-项目关联表 (新增 - 权限分配)
-- 变更: 2026-05-21 - 新增用户项目权限
-- sysadmin 角色无需在此表记录, 逻辑上对所有项目可见
-- ============================================
CREATE TABLE IF NOT EXISTS `user_projects` (
  `id`          BIGINT(20)   NOT NULL AUTO_INCREMENT COMMENT '记录ID',
  `user_id`     BIGINT(20)   NOT NULL COMMENT '用户ID',
  `project_id`  VARCHAR(64)  NOT NULL COMMENT '项目ID',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_project` (`user_id`, `project_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_project_id` (`project_id`),
  CONSTRAINT `fk_up_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_up_project` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户-项目关联表';
```

### 初始化数据

```sql
-- 预置 sysadmin 账号 (密码: admin123, BCrypt 加密)
-- 变更: 2026-05-21 - 初始管理员账号
INSERT IGNORE INTO `users` (`username`, `password`, `display_name`, `role`, `status`)
VALUES ('sysadmin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '系统管理员', 'sysadmin', 1);
```

### EE: 现有表无变更

本项目所有现有表（`projects`, `test_cases`, `ai_config`, `reports`, `execution_record`）**字段无需修改**。用户信息的注入在 Service 层通过 SecurityContextHolder 获取当前用户 ID 和角色。

## Implementation Notes

### JwtUtil 核心方法

```java
// 生成 Token
String generateToken(Long userId, String username, String role);

// 从 Token 中解析 Claims
Claims parseToken(String token);

// 验证 Token 是否有效
boolean validateToken(String token);

// 从 Request 中提取 Token
String extractToken(HttpServletRequest request);
```

### SecurityConfig 配置要点

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) {
        http
            .csrf(csrf -> csrf.disable())  // API 无需 CSRF
            .sessionManagement(sm -> sm.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/platform/auth/login").permitAll()
                .requestMatchers("/api/platform/callback/**").permitAll()
                .requestMatchers("/swagger-ui.html", "/v3/api-docs/**").permitAll()
                .requestMatchers("/actuator/health").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
```

### 数据过滤 Service 层示例

```java
@Service
public class ProjectService extends ServiceImpl<ProjectMapper, Project> {
    
    public PageResult<Project> listWithAuth(int page, int size, String name, 
                                             Long currentUserId, String role) {
        LambdaQueryWrapper<Project> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Project::getDeleted, 0);
        
        // 非 sysadmin 需要按用户项目权限过滤
        if (!"sysadmin".equals(role)) {
            wrapper.in(Project::getId, 
                sqlSession.selectList("getUserProjectIds", currentUserId));
        }
        
        if (StrUtil.isNotBlank(name)) {
            wrapper.like(Project::getName, name);
        }
        
        Page<Project> p = page(new Page<>(page, size), wrapper);
        return PageResult.of(p.getTotal(), p.getRecords());
    }
}
```

### 前端 token 存储与传递

```typescript
// stores/auth.ts
export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref<UserInfo | null>(null);
  
  async function login(username: string, password: string) {
    const res = await axios.post('/api/platform/auth/login', { username, password });
    token.value = res.data.token;
    user.value = res.data.user;
    localStorage.setItem('token', res.data.token);
  }
  
  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
  }
  
  const isAuthenticated = computed(() => !!token.value);
  const isSysadmin = computed(() => user.value?.role === 'sysadmin');
});
```

```typescript
// axios 请求拦截器
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```
