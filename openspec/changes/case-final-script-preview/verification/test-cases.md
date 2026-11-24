# 验收用例清单：case-final-script-preview

## 单元测试（代码位置：backend/platform-service/src/test/java/com/smarttesting/platform/service/CaseExecutionServiceTest.java）

| # | 用例 | 覆盖点 | 状态 |
|---|---|---|---|
| U1 | stripLoginTask 剔除「登录」task | YAML+登录方式时最终脚本剔除登录 task | 通过 |
| U2 | stripLoginTask 单 task 原样返回 / 无登录 task / 空输入 | 边界安全 | 通过 |
| U3 | extractWebUrl 提取 web.url / 未找到返回 null | NLP 模式 targetUrl 提取 | 通过 |
| U4 | previewFinalScript：YAML 模式+绑定登录方式 | 剔除登录 task + 注入登录负载 + 登录 YAML 模板（单引号转义、[动态]→cacheable:false、aiWaitFor 收尾） | 通过 |
| U5 | previewFinalScript：NLP 模式 | 剥离登录前缀 + targetUrl 提取 | 通过 |
| U6 | previewFinalScript：yamlFlow 未生成 | 200 + warnings 告警（不抛错） | 通过 |
| U7 | previewFinalScript：免登录（type=none） | 不注入登录负载、无登录 YAML 预览、不剔除 task | 通过 |
| U8 | previewFinalScript：登录方式含预生成 yamlScript | 透出其 tasks | 通过 |
| U9 | buildExecuteRequest：warnings=null（执行路径） | 缺失内容不记录告警；默认 headless/timeout | 通过 |
| U10 | buildExecuteRequest：customYaml 优先于 yamlFlow | 执行时自定义 YAML 生效 | 通过 |

## API 验收用例（用户自测清单）

| # | 步骤 | 预期 |
|---|---|---|
| A1 | 登录平台，打开任一用例详情页，点"最终脚本" | 弹窗展示执行模式/目标网址/登录方式 + 业务脚本 + 登录阶段脚本 |
| A2 | YAML 模式 + 绑定登录方式的用例 | 业务 YAML 中无「登录」task；登录 YAML 模板含账号/密码/aiWaitFor |
| A3 | NLP 模式用例（如 id=2111011226372927490，CAS 登录） | nlp 为剥离登录前缀后的业务步骤；targetUrl 为 YAML web.url |
| A4 | yamlFlow 未生成的 YAML 用例 | 弹窗顶部出现告警条"yamlFlow 未生成，执行时将被拒绝" |
| A5 | `GET /api/platform/cases/{id}/final-script` 不存在的 id | 404 {"error":"用例不存在: ..."} |
| A6 | 编辑器修改未保存时点"最终脚本" | 预览仍是已保存内容（弹窗底部有提示文案） |
