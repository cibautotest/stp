# 验收结论报告：case-login-method-editing

## 功能

用例详情页开放登录方式增删改：编辑入口（基本信息"登录方式"行）→ 弹窗支持
换绑/解绑（免登录）、编辑登录方式内容（类型/登录网址/账号/密码/补充步骤）、
新建登录方式并绑定、删除登录方式（先解绑当前用例，他用例引用时展示拒绝原因）。
后端行为修正：登录核心字段变更时 cacheStatus 强制重置 uncached（防旧缓存以错误身份登录）。

## 改动清单

| 层 | 文件 | 改动 |
|---|---|---|
| 后端 | `service/LoginMethodService.java` | updateMethod 增加存在性校验 + 变更检测（`hasLoginContentChanged` 纯函数）→ cacheStatus 重置 |
| 后端 | `test/.../LoginMethodServiceTest.java` | 新增 5 个纯函数用例 |
| 前端 | `views/detail/index.vue` | "登录方式"编辑按钮 + 管理弹窗（增删改/换绑），表单与创建页同构（ExtraStep ↔ `[动态]` stepsNlp） |

零新增 API（复用 login-methods CRUD 与 updateCase）；无 SQL 迁移；执行引擎不受影响。

## 验证结论

后端编译/单测、前端 lint/build 全部通过；运行时验收由用户执行（A1-A7）。
**变更暂不归档**，待用户自测通过后再 archive。

## 部署清单

- platform-service jar（或重建 stp-platform 镜像）
- 前端 dist（或重建 stp-frontend 镜像）
