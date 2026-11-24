# 验证证据：case-final-script-preview

## 已完成验证（2026-10-16）

| 项 | 结果 | 证据 |
|---|---|---|
| 后端编译 `mvn -q -pl platform-service -am compile -DskipTests` | 通过 | COMPILE_EXIT=0 |
| 单元测试 `mvn -q -pl platform-service test -Dtest=CaseExecutionServiceTest` | 13/13 通过 | TEST_EXIT=0（首轮 12/13，断言修正后全绿；日志含"已剔除 YAML 中的登录 task""已剥离 nlp 中残留的登录前缀""Final script preview built"） |
| 前端 `read_lints`（detail/index.vue + api/cases.ts） | 零错误 | totalCount=0 |

单测输出关键行（Surefire）：
```
[CaseExecution] 已剔除 YAML 中的登录 task（由登录方式阶段执行）
[CaseExecution] 已剥离 nlp 中残留的登录前缀（登录由登录方式阶段执行）
[CaseExecution] Final script preview built: caseId=1002, mode=NLP, loginMethod=true
Tests run: 13, Failures: 0, Errors: 0, Skipped: 0 → TEST_EXIT=0
```

## 未验证项（用户自行测试）

按用户指示（"测试工作可以我自己来"），以下未在本轮执行：

- **API 实测**：`GET /api/platform/cases/{id}/final-script` 未在运行环境实测。原因：本地平台跑在 Docker 容器（stp-platform:latest2 为旧镜像，不含新代码），未重建镜像。
- **端到端**：详情页按钮 → 弹窗展示 → 复制按钮，未实操（前端 read_lints 零错误，但未在浏览器中走通）。
- **执行链路回归**：`execute()` 重构为调用 `buildExecuteRequest` 后未实际发起一次执行验证（逻辑等价重构，单测覆盖组装路径，但未跑真实执行冒烟）。

建议自测素材：用例 `2111011226372927490`（NLP 模式 + CAS 登录方式 2111011116222115841，yaml_flow 含登录 task），可直接验证 A2/A3 场景（见 test-cases.md）。

## 环境备注

- 本机 JDK 11 实际路径为 `C:\Program Files\Java\jdk-11.0.32`（规则文档中的 `D:\jdk-11` 不存在于本机），编译/测试已用实际路径完成。
