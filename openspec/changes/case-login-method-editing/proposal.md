# Proposal: 用例详情页开放登录方式的增删改

## 背景 (Why)

用例详情页的"登录方式"仅作展示，无法编辑：换绑/解绑要靠后端 API（`PUT /cases/{id}` 支持 `loginMethodId`，空串=解绑），登录方式内容（登录网址/账号/密码/补充步骤）的修改更是没有任何 UI 入口，用户只能重建登录方式。

后端能力其实已齐全（`LoginMethodController` 有完整 CRUD、`updateCase` 支持改绑），缺的是前端入口；另有一个语义缺陷：**编辑登录核心信息后 `cacheStatus` 仍为 cached**，执行时执行机会复用旧缓存 `login_{id}` 跳过登录——改了账号密码却以旧身份执行，必须随内容变更重置为 uncached。

## 目标 (What)

1. 前端详情页"登录方式"行新增编辑入口，弹窗提供：
   - **换绑/解绑**：下拉选择项目下登录方式或"免登录"，确认后 `updateCase(loginMethodId)`；
   - **改**：编辑选中登录方式的类型/登录网址/账号/密码/补充步骤（`[动态]` 结构化编辑，与创建页同构），保存调 `updateLoginMethod`（name/roleName 随账号同步）；
   - **增**：新建登录方式并自动绑定当前用例（`createLoginMethod` + `updateCase`）；
   - **删**：删除选中登录方式（先解绑当前用例；被同项目其他用例引用时后端拒绝并提示）。
2. 后端 `LoginMethodService.updateMethod`：登录核心字段（type/loginUrl/username/password/stepsNlp/yamlScript）发生变化时强制 `cacheStatus=uncached`。

## 范围 (Scope)

- In：`LoginMethodService.java`（缓存失效重置，纯函数抽离可测）、`views/detail/index.vue`（编辑弹窗）、新增 `LoginMethodServiceTest`。
- Out：后端新增/修改 API（零新增，复用既有 CRUD 与 `updateCase`）；`login_methods` 表结构不变；插件端不改。

## 影响

- 纯前端 + 一处后端行为修正；无 SQL 迁移；执行引擎不受影响。
