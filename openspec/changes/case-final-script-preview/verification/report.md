# 验收结论报告：case-final-script-preview

## 功能

用例详情页新增"最终脚本"入口，展示后端组装完成、即将下发执行机的最终 Midscene 脚本：
执行模式、targetUrl、登录方式负载、业务脚本（YAML 模式剔除登录 task 后 / NLP 模式剥离登录前缀后）、
登录阶段 YAML 预览（与执行机 buildLoginYaml 模板同步）、缺失内容告警。

## 改动清单

| 层 | 文件 | 改动 |
|---|---|---|
| 后端 | `model/FinalScriptPreview.java` | 新增 DTO |
| 后端 | `service/CaseExecutionService.java` | 抽取 `buildExecuteRequest`（执行/预览共用）；新增 `previewFinalScript`、`buildLoginYamlPreview` |
| 后端 | `controller/TestCaseController.java` | 新增 `GET /{id}/final-script` |
| 后端 | `test/.../CaseExecutionServiceTest.java` | 新增 7 个预览/组装用例（共 13 个，全绿） |
| 前端 | `api/cases.ts` | 新增 `FinalScriptPreview` 类型 + `getFinalScript` |
| 前端 | `views/detail/index.vue` | 页头"最终脚本"按钮 + 预览弹窗（告警条/descriptions/脚本块/复制/提示） |

## 验证结论

- 后端编译：通过（exit 0）
- 单元测试：13/13 通过（含最终脚本组装、登录 YAML 模板、缺失告警、免登录分支）
- 前端 lint：零错误
- 执行链路 `execute()` 为逻辑等价重构（组装代码原样搬移为 `buildExecuteRequest`，headless 覆盖移至执行路径），单测覆盖两条路径

**未验证项**（用户自测）：运行环境 API 实测、浏览器端到端、真实执行冒烟——本地平台跑在旧 Docker 镜像中，未重建镜像；自测用例见 `test-cases.md` A1-A6。

## 结论

功能开发完成，编译/单测/lint 全部通过；运行时验收由用户执行（见 test-cases.md）。**变更暂不归档**，待用户自测通过后再 archive。
