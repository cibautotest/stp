---
name: stp-e2e-verify
description: 智能测试中台（STP）端到端验收 SOP。当功能开发完成需要 API 级实测、用户要求"验收/验证/跑一遍"登录方式、用例创建执行、缓存标记等核心链路时使用。提供可直接执行的 PowerShell 命令序列。
metadata:
  author: stp-team
  version: "1.0"
---

# STP 端到端验收 SOP

环境前置：前端 :3000 / 网关 :8080 / platform :8081 / execute-service :3001 均 UP（先 `Test-NetConnection` 确认，DOWN 则按「项目架构与开发规范」规则重启）。

## 关键坑（每条都是实战教训）

1. **PowerShell 含中文的 JSON body 必须 UTF8 字节传输**，否则 400 误判：
   `[System.Text.Encoding]::UTF8.GetBytes($json)` 配合 `-ContentType "application/json; charset=utf-8"`
2. 执行机地址取自 DB `users.execute_service_url`（用户级优先）→ `projects.execute_service_url`，执行报 400 先查这两张表；
3. 探测数据（测试用登录方式/用例）验收完**必须删除**。

## 标准验收序列

### 1. 登录取 token
```powershell
$token = (Invoke-RestMethod -Method Post -Uri "http://localhost:8081/api/platform/auth/login" -ContentType "application/json" -Body '{"username":"sysadmin","password":"admin123"}').token
$h = @{"Authorization"="Bearer $token"}
```

### 2. 登录方式链路
- `POST /api/platform/login-methods` 创建（断言返回 id 且 cacheStatus=uncached）
- `GET /api/platform/login-methods?projectId=<pid>` 列表（断言新记录在列）
- `PUT /api/platform/login-methods/{id}/cache-status`（无 token，免鉴权通道）→ 再查列表断言 cacheStatus=cached

### 3. 用例创建+执行链路
- `POST /api/platform/execute/create-and-execute`（带 loginMethodId）→ 返回 executionId
- 轮询 `GET http://localhost:3001/execute/{executionId}/status`（10s 间隔，最多 3 分钟）
- 断言终态 status 为 completed（failed 时取 error 字段并按 midscene-yaml-doctor 技能排障）

### 4. 登录缓存验证
- 首次执行后：`execute-service/midscene_run/cache/login_<methodId>.cache.yaml` 应存在
- 同登录方式二次执行：执行日志中登录阶段应明显提速（缓存命中）

### 5. 收尾
- `DELETE /api/platform/login-methods/{id}` 删除探测登录方式
- 删除探测用例；清理 `probe-*` 开头的执行记录（如有）

## 隔离排障（链路不通时）

跳过平台，直连执行引擎定位问题层：
```powershell
$body = @{ id="probe-001"; name="probe"; nlp="点击登录"; executionMode="NLP"; headless=$true;
  loginMethod=@{ id="<lmId>"; type="cas"; loginUrl="http://localhost:3000/#/login"; username="u"; password="p" };
  targetUrl="http://localhost:3000" } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "http://localhost:3001/execute/async" -ContentType "application/json; charset=utf-8" -Body ([System.Text.Encoding]::UTF8.GetBytes($body))
```
直连成功而平台链路失败 → 问题在 platform-service 参数组装/执行机地址解析；直连也失败 → 问题在执行引擎或被测页面。
