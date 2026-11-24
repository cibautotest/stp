# Tasks: case-final-script-preview

- [x] 1. 后端：抽取 `CaseExecutionService.buildExecuteRequest`（执行与预览共用组装路径，execute 行为不变）
- [x] 2. 后端：新增 `model/FinalScriptPreview.java` DTO
- [x] 3. 后端：`CaseExecutionService.previewFinalScript` + `buildLoginYamlPreview`（移植执行机模板）
- [x] 4. 后端：`TestCaseController` 新增 `GET /{id}/final-script`
- [x] 5. 后端单测（red-green）：`CaseExecutionServiceTest` 覆盖 previewFinalScript（YAML 剔除登录 task / NLP 剥离前缀+targetUrl / 缺失内容告警）与 buildLoginYamlPreview 模板
- [x] 6. 后端编译：`mvn -q -pl platform-service -am compile -DskipTests`（exit 0）+ `CaseExecutionServiceTest` 13/13 通过
- [x] 7. 前端：`api/cases.ts` 新增 `getFinalScript`
- [x] 8. 前端：`views/detail/index.vue` 新增"最终脚本"按钮与预览弹窗
- [x] 9. 验证：前端 `read_lints` 零错误；~~API 实测~~（用户自行测试，见 verification/test-cases.md A1-A6）
- [x] 10. 归档验证资产到 `verification/`（test-cases.md / evidence.md / report.md，未验证项已明示）
