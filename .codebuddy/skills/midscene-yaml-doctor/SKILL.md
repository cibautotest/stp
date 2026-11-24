---
name: midscene-yaml-doctor
description: STP 用例执行失败排障手册。当用例执行报错、"打不开网址"、页面为空、缓存不生效、登录阶段失败、断言失败时使用。提供症状→根因→检查的决策树，所有检查项均来自项目实战沉淀。
metadata:
  author: stp-team
  version: "1.0"
---

# Midscene 执行失败排障决策树

总原则：**先环境后代码**。按 端口 → 配置 → 数据 → 日志 → 直连隔离 → 代码 的顺序排查，不要一上来改代码。

## 症状 1：打不开网址 / 浏览器停在空白页 / 报"页面为空"

按命中率排序检查：

1. **execute-service 端口冲突**：`.env` 的 `PORT` 必须是 3001。若是 3000，则与前端冲突——被测地址指向 `localhost:3000` 时实际打到执行引擎 API（返回 JSON），AI 看到的就是"空页面"。
   检查：`netstat -ano | findstr ":3000.*LISTENING"` 看 3000 上是 node 前端还是 execute-service。
2. **执行机地址配置错**：DB 查 `users.execute_service_url`、`projects.execute_service_url`，必须是执行引擎真实可达地址（如 `http://localhost:3001` 或服务器 IP:3001）。WSL 虚拟网卡地址（172.28.x.x）在宿主机可能不可达。
3. **NLP 缺网址**：NLP 模式（runNlp）不自动导航。检查后端是否注入了 `targetUrl`（CaseExecutionService 从 yamlFlow 提取 web.url）；免登录方式前端是否把 `打开 {url}` 拼进了 NLP。
4. **登录方式未注入**：执行已有用例走 `CaseExecutionService`，新建执行走 `CreateAndExecuteService`——两条链路都要注入 loginMethod，改了一条漏另一条就会出现"新建能跑、保存的用例跑不了"。
5. **跳回登录页**：业务 YAML 的 `web.url` 与登录页相同且未跳过重复导航 → 登录完成后又 goto 登录页。yaml-runner 有 `urlsEqual` 规范化比较，确认其生效。

## 症状 2：登录阶段执行了但业务步骤失败（页面在跳转中）

- 登录 YAML 末尾必须有 `aiWaitFor: '登录已完成，页面已进入登录后的主界面'`（等跳转完成再进业务步骤）；
- 该步骤是查询类，天然不缓存，不影响登录缓存复用。

## 症状 3：缓存不生效 / 每次都走 AI

1. 查缓存文件：`execute-service/midscene_run/cache/login_<methodId>.cache.yaml`（登录）与 `<caseId>.cache.yaml`（用例）是否存在、非空；
2. 写缓存失败是**静默 warn**（midscene SDK 行为），查执行引擎日志 `logs/execute-service*.log` 的 warn；
3. 磁盘空间不足会导致写缓存失败（`Get-PSDrive C`）；
4. 确认步骤没被标 `cacheable: false`（`[动态]` 前缀的步骤故意不缓存，属预期）；
5. 断言/查询类步骤（aiAssert/aiQuery/aiWaitFor）永不缓存，属 SDK 设计。

## 症状 4：断言失败

- **"断言文件"类指令被守卫拦截**：插件 aiAct 守卫会拦截含"断言/验证…文件"的指令走 `__stpFileStepHandler`；复合指令"点击下载，断言文件里有X"应先执行下载再断言（处理器拆分逻辑），若报"未检测到下载"说明下载部分未执行或被跳过；
- 页面断言失败：先拿执行报告截图确认页面状态，再判断是步骤问题还是断言期望问题。

## 症状 5：执行记录莫名 FAILED / 状态查询 404（提交成功却查不到）

**根因（2026-09-30 实战）**：僵尸 vite 实例抢占 3001 端口与执行引擎**双绑**（vite 在 3000 被占时自动递增到 3001，Windows SO_REUSEADDR 允许双绑）。后果：提交请求落到真引擎（返回 eid），状态查询落到 vite → vite 把 /execute 代理到网关 8080 → Spring 格式 404 → 平台同步服务把执行标记 FAILED。

识别特征：
- `GET :3001/health` 返回 **HTML（含 /@vite/client）** 而非 JSON → 3001 被 vite 抢占
- `POST :3001/execute/async` 返回带 `requestId` 的 **Spring 格式 404** → 请求被代理到了网关

处置：
1. `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` 找出多余 vite 进程并 taskkill
2. 根治：frontend/vite.config.ts 已加 `strictPort: true`（3000 被占直接报错，不再递增）
3. 同类教训：低内存机器 JVM malloc 失败 → start-platform.bat 已内置 MAVEN_OPTS=-Xmx256m 与各服务 jvmArguments 堆限制

## 症状 6：执行提交即 400

- PowerShell 中文编码：body 必须 `[System.Text.Encoding]::UTF8.GetBytes($json)`；
- 执行机未配置：报"未配置执行机"→ 查 DB users/projects 表；
- 字段超长：DTO 有 @Size 校验，看响应 error 字段。

## 日志位置

| 服务 | 日志 |
|---|---|
| platform-service | `logs/platform.log`、`logs/platform-err.log` |
| execute-service | `logs/execute-service.log`、`logs/execute-service-err.log` |
| 执行报告 | execute-service `midscene_run/report/` |

日志关键字：`Login method`、`CaseExecution`、`登录阶段`、`targetUrl`、`ERROR`。
