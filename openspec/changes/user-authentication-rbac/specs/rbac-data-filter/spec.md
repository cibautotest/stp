# Capability: 权限数据过滤

## 描述

根据当前登录用户的角色和项目关联，自动过滤数据查询结果。`sysadmin` 可见全量，`general` 仅可见关联项目的数据。

## 数据过滤规则

```
┌──────────────────────────────────────────────────────────┐
│                    权限数据过滤逻辑                        │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  获取当前用户: SecurityContextHolder.getAuthentication() │
│       │                                                  │
│       ▼                                                  │
│  ┌──────────────────────┐                                │
│  │ role == 'sysadmin' ?  │                                │
│  └──────────┬───────────┘                                │
│        YES  │         NO (general)                       │
│        ┌────▼────┐   ┌──▼─────────────────┐              │
│        │ 不做过滤 │   │ 查询 user_projects  │              │
│        │ 返回全部 │   │ 获取该用户的        │              │
│        │ 数据     │   │ 项目ID列表          │              │
│        └─────────┘   └──┬──────────────────┘              │
│                         │                                 │
│                    ┌────▼─────────────────┐              │
│                    │ 所有查询追加条件:      │              │
│                    │ WHERE project_id IN   │              │
│                    │ (用户关联的项目ID列表)  │              │
│                    └──────────────────────┘              │
└──────────────────────────────────────────────────────────┘
```

## 受影响的接口

### 项目列表 - GET /api/platform/projects

```java
// 原逻辑
wrapper.eq(Project::getDeleted, 0);
if (StrUtil.isNotBlank(name)) wrapper.like(Project::getName, name);

// 新逻辑
wrapper.eq(Project::getDeleted, 0);
if (!"sysadmin".equals(currentUser.getRole())) {
    wrapper.in(Project::getId, getUserProjectIds(currentUser.getId()));
}
if (StrUtil.isNotBlank(name)) wrapper.like(Project::getName, name);
```

### 用例列表 - GET /api/platform/cases?projectId=xxx

```java
// 原逻辑 - 检查 projectId 是否存在
// 新逻辑 - 额外校验用户是否有权限访问该 projectId
if (!"sysadmin".equals(currentUser.getRole())) {
    List<String> allowedProjectIds = getUserProjectIds(currentUser.getId());
    if (!allowedProjectIds.contains(projectId)) {
        throw new AccessDeniedException("无权访问该项目");
    }
}
```

### 报告列表 - GET /api/platform/reports

```java
// 新逻辑
if (!"sysadmin".equals(currentUser.getRole())) {
    // 只查询有权限项目的用例对应的报告
    List<String> allowedCaseIds = getCasesByProjectIds(getUserProjectIds(currentUser.getId()));
    wrapper.in(Report::getCaseId, allowedCaseIds);
}
```

### 首页统计

获取项目统计、用例统计、每日执行趋势等接口都需要加入类似的项目权限过滤。

## 技术实现

### 获取当前用户信息

```java
// 方式1: 从 SecurityContextHolder 直接获取
Authentication auth = SecurityContextHolder.getContext().getAuthentication();
if (auth != null && auth.getPrincipal() instanceof UserDetails) {
    UserDetails userDetails = (UserDetails) auth.getPrincipal();
    // 获取 userId 和 role
}

// 方式2: Controller 参数注入 (推荐)
@GetMapping
public ApiResult list(@AuthenticationPrincipal UserDetails userDetails) {
    // 直接使用 userDetails
}
```

### 在 Service 层获取用户信息

推荐通过 `BaseContext` 或 ThreadLocal 工具类在当前请求线程中存储用户信息：

```java
public class BaseContext {
    private static final ThreadLocal<Long> userIdHolder = new ThreadLocal<>();
    private static final ThreadLocal<String> roleHolder = new ThreadLocal<>();
    
    public static void setUserId(Long userId) { userIdHolder.set(userId); }
    public static Long getUserId() { return userIdHolder.get(); }
    public static void setRole(String role) { roleHolder.set(role); }
    public static String getRole() { return roleHolder.get(); }
    public static void clear() { userIdHolder.remove(); roleHolder.remove(); }
}
```

在 `JwtAuthenticationFilter` 中解析 token 后调用 `BaseContext.setUserId()` / `BaseContext.setRole()`，在请求完成后调用 `BaseContext.clear()` 清理。

## 前端权限控制

### 侧边栏入口控制

```typescript
// MainLayout.vue
const visibleMenus = computed(() => {
  const auth = useAuthStore();
  return menus.filter(menu => {
    if (menu.path === '/config' || menu.path === '/users') {
      return auth.isSysadmin;
    }
    return true; // 其他页面所有登录用户可访问
  });
});
```

### API 层错误处理

```typescript
// axios 响应拦截器 (已有逻辑，增强)
if (error.response?.status === 401) {
  // token 过期 → 清除 store 并跳转登录
  const auth = useAuthStore();
  auth.logout();
  router.push('/login');
  ElMessage.error('登录已过期，请重新登录');
}
if (error.response?.status === 403) {
  ElMessage.error('无权限执行此操作');
}
```
