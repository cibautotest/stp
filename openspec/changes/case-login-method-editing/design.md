# Design: 用例详情页登录方式增删改

## 后端：缓存失效重置

`LoginMethodService.updateMethod` 更新前先 `getById` 取旧记录，用静态纯函数
`hasLoginContentChanged(old, new)` 比对核心字段（提交值为 null 表示不修改，对齐
MyBatis-Plus updateById 非 null 更新语义）；有变化则强制 `setCacheStatus("uncached")`。
执行机下次执行登录阶段时缓存 miss → 重新登录生成新缓存。

## 前端：详情页登录方式弹窗

- 基本信息卡"登录方式"值尾部加编辑小按钮（复用名称行 hover 显示样式）。
- 弹窗三态（`loginDialogSelectedId`）：`''` 免登录 / 已有 id / `'__NEW__'` 新建。
- 表单与创建页同构（ExtraStep：valueType/customName/desc；stepsNlp ↔ `[动态] desc` 行），
  反向解析时 valueType 统一置"自定义"（valueType 仅为录入辅助，不入库）。
- 保存登录信息：`updateLoginMethod(id, {type, loginUrl, username, password, stepsNlp,
  name: '{type}登录-{username}', roleName: username})`，不传 cacheStatus（由后端决定是否重置）。
- 删除：ElMessageBox 确认 → 当前用例绑定时先 `updateCase(loginMethodId: '')` →
  `deleteLoginMethod`；后端因他用例引用拒绝时（400 error）toast 展示。
- 换绑：`updateCase(id, {loginMethodId})` 后以响应回填 detail。

## 文件

| 层 | 文件 | 改动 |
|---|---|---|
| 后端 | `service/LoginMethodService.java` | updateMethod 缓存重置 + hasLoginContentChanged |
| 后端 | `test/.../LoginMethodServiceTest.java` | 新增：纯函数变化检测用例 |
| 前端 | `views/detail/index.vue` | 登录方式编辑弹窗（增删改/换绑/解绑） |
