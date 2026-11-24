# Design: 登录图形验证码

## 后端

### CaptchaService（内存存储，无状态依赖）

```
ConcurrentHashMap<String key, Entry{code, expireAt}>
generate(): 清理过期 → 生成 4 位码（字符集 ABCDEFGHJKLMNPQRSTUVWXYZ23456789，去易混淆）
           → BufferedImage 120x40 绘制（浅色底 + 干扰线/噪点 + 随机旋转字符，Font.SANS_SERIF）
           → PNG → base64 → CaptchaResponse{key=UUID, image="data:image/png;base64,..."}
verify(key, code): null/blank → false；store.remove(key)（一次性）；过期 → false；
                 忽略大小写比对
peekCode(key): 包私有，仅单测用
```

- 过期 5 分钟；惰性清理（generate 时清一遍，量级小无需定时任务）。

### 校验接入点（AuthController.login）

```
if (body.captchaKey 非空) {
    if (!captchaService.verify(captchaKey, captchaCode)) return 400 {"error": "验证码错误或已过期"}
}
// 之后的原登录逻辑不变（用户名/密码 401）
```

- 可选校验语义：插件不带 captchaKey 不受影响（见 proposal 约束）。
- 校验在认证之前 → 登录失败（401/400）验证码均已被消费，前端必须刷新。

### 免鉴权

`SecurityConfig` 白名单：`/api/platform/auth/captcha` permitAll（紧邻 login 白名单）。

### 容器字体

Dockerfile：`apt-get install -y --no-install-recommends fontconfig fonts-dejavu-core`，
否则 jre-slim 镜像 `Font.SANS_SERIF` 无字体映射，drawString 抛异常。

## 前端

- `api/auth.ts`：`getCaptcha()`；`login(u, p, captchaKey?, captchaCode?)`。
- `api/axios.ts`：400 且响应含 `error` 时展示后端 error 文案（放在 switch 之前，其他 400 接口同样受益）。
- `stores/auth.ts`：`login` 透传验证码；catch 中若 error 为验证码错误则 rethrow（登录页需区分"刷新验证码"与"用户名密码错误"）。
- `views/login/index.vue`：验证码 form-item（输入框 + 图片点击刷新）；onMounted 加载；
  登录成功 → 原逻辑；false（401）→ "用户名或密码错误" + 刷新验证码；
  catch（400 验证码）→ 刷新验证码（toast 由 axios 拦截器统一弹出）。

## 单测（CaptchaServiceTest）

generate（key/image 非空、image data URI 前缀）、verify（正确通过、一次性消费、错误码、
大小写不敏感、不存在 key、null/blank、peekCode 辅助）。

## 文件

| 层 | 文件 | 改动 |
|---|---|---|
| 后端 | `model/CaptchaResponse.java` | 新增 |
| 后端 | `service/CaptchaService.java` | 新增（绘图 + 内存存储 + 校验） |
| 后端 | `model/LoginRequest.java` | +captchaKey/captchaCode（可选） |
| 后端 | `controller/AuthController.java` | +GET /captcha；login 校验 |
| 后端 | `security/SecurityConfig.java` | 白名单 +captcha |
| 后端 | `Dockerfile` | +fontconfig 字体 |
| 后端 | `test/.../CaptchaServiceTest.java` | 新增 |
| 前端 | `api/auth.ts` / `stores/auth.ts` / `views/login/index.vue` / `api/axios.ts` | 验证码流程 |
