# 验证证据 — login-method-reuse

## 编译验证

| 层 | 命令 | 结果 |
|----|------|------|
| 后端 | `mvn -q -pl platform-service -am compile -DskipTests`（JAVA_HOME=D:\jdk-11） | EXIT 0 |
| 执行引擎 | `npx tsc`（dist 不含 tests/） | EXIT 0 |
| 前端 | `read_lints`（create/cases/detail/index.vue、api/cases.ts、stores/cases.ts） | 零错误 |
| 插件 | `node --check`（export-test-case.js 等） | 语法 OK |

## 单元测试

| 层 | 命令 | 结果 |
|----|------|------|
| 后端 | `mvn test -Dtest=CaseExecutionServiceTest`（JDK 11） | 7/7 通过 |
| 引擎 | `npx vitest run` | 6/6 通过 |
| 前端 | `npx vitest run` | 9/9 通过 |

## API 实测摘要（2026-09-28，sysadmin）

1. **创建登录方式**：POST /api/platform/login-methods → 201，cacheStatus=uncached（注：中文 body 必须 UTF8 字节传输，否则 400 属 PowerShell 编码问题非代码缺陷）
2. **缓存状态回调**：PUT .../cache-status {"status":"cached"}（无 token）→ `{"ok":true}`；再查列表 cacheStatus=cached ✓
3. **登录阶段探测**（直连 :3001/execute/async，loginMethod type=cas）：
   - 首次探测失败："页面未加载成功" → 定位：登录 YAML 缺等待跳转 → 修复：模板末尾加 `aiWaitFor 登录完成`
   - 二次探测失败："页面为空" → 定位：execute-service `.env` PORT=3000 与前端冲突，被测地址打到 API → 修复：改 PORT=3001
   - 修复后：登录阶段执行 → 业务步骤执行，链路打通
4. **执行机地址**：DB users/projects.execute_service_url 为 `http://172.28.16.1:3001`（WSL 地址），实测宿主机可达；已记录为排障检查项

## 关键修复记录（排障证据）

| 问题 | 根因 | 修复 |
|------|------|------|
| 调试不打开网址 | 新提示语使 NLP 不含网址，调试/免登录链路无人注入 | handleDebug 合并 NLP；免登录 NLP 前置"打开{url}"；execute-service runNlp 支持 targetUrl |
| 保存的用例执行空白页 | CaseExecutionService 未注入 loginMethod（只改了 create-and-execute 链路） | 注入 loginMethod + targetUrl；YAML 模式 stripLoginTask 防重复登录 |
| 登录后业务步骤失败 | 点击登录后未等跳转完成 | 登录 YAML 末尾 aiWaitFor |
| 跳回登录页 | 业务 YAML web.url=登录页，重复导航 | urlsEqual 规范化比较，相同则跳过 goto |
