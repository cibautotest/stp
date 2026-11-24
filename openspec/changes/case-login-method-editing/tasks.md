# Tasks: case-login-method-editing

- [x] 1. 后端：`LoginMethodService.updateMethod` 登录核心字段变更时重置 `cacheStatus=uncached`（抽 `hasLoginContentChanged` 纯函数）
- [x] 2. 后端单测：`LoginMethodServiceTest` 覆盖变化检测（各字段/null 不修改/无变化）——5/5 通过
- [x] 3. 后端编译通过（COMPILE_EXIT=0）
- [x] 4. 前端：详情页"登录方式"编辑弹窗（换绑/解绑、编辑保存、新建并绑定、删除）
- [x] 5. 前端 `read_lints` 零错误 + `npm run build` 通过
- [x] 6. verification 资产归档（用户自测项 A1-A7 已列明）
