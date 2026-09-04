# 技术设计 — 登录方式复用

## 一、数据模型

```sql
CREATE TABLE `login_methods` (
  `id` VARCHAR(64) NOT NULL,
  `project_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL COMMENT '登录方式名称',
  `type` VARCHAR(16) NOT NULL COMMENT 'none/cas/local',
  `login_url` VARCHAR(512) DEFAULT NULL COMMENT '登录页地址',
  `role_name` VARCHAR(64) DEFAULT NULL COMMENT '角色名（如 管理员/普通用户）',
  `username` VARCHAR(128) DEFAULT NULL,
  `password` VARCHAR(256) DEFAULT NULL COMMENT '加密存储',
  `steps_nlp` MEDIUMTEXT COMMENT '登录补充步骤（图形验证码/弹窗处理等 NLP）',
  `yaml_script` MEDIUMTEXT COMMENT '生成的登录 YAML',
  `cache_status` VARCHAR(16) NOT NULL DEFAULT 'uncached' COMMENT 'uncached/cached',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`), INDEX `idx_project_id` (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE `test_cases`
  ADD COLUMN `login_method_id` VARCHAR(64) DEFAULT NULL COMMENT '关联登录方式',
  ADD INDEX `idx_login_method_id` (`login_method_id`);
```

- `none` 类型：无需 url/账号字段，作为"必选其一"的占位选项
- `cache_status` 由执行引擎完成登录阶段后回调更新

## 二、执行链路（核心）

```
CreateAndExecuteRequest { projectId, directoryId, loginMethodId, name, nlp, customYaml }
        │
        ▼
CreateAndExecuteService.createAndExecute
        │  TestCase.loginMethodId = loginMethodId（必填校验）
        ▼
execute-service POST /execute
  ExecuteRequest { loginMethod: { id, type, loginUrl, username, password, stepsNlp, yamlScript } }
        │
        ▼
yaml-runner.ts
  ┌─ 登录阶段（type != none 时）─────────────────────────┐
  │ agent_login = new PlaywrightAgent(page, {            │
  │   cache: { id: 'login_' + loginMethodId },           │
  │   generateReport: false                              │
  │ })                                                   │
  │ runYaml(登录 YAML)                                    │
  │   首次 → AI 生成并写缓存；后续 → 缓存命中              │
  │   失败 → 用例整体失败（登录失败报告）                   │
  │ 成功后 → 回调 platform 更新 cache_status='cached'      │
  └──────────────────────────────────────────────────────┘
        │ 同一 page，不关闭浏览器
        ▼
  ┌─ 用例主体 ────────────────────────────────────────────┐
  │ agent = new PlaywrightAgent(page, {                   │
  │   cache: { id: caseId }, generateReport: true })      │
  │ runYaml(用例 YAML)                                    │
  └──────────────────────────────────────────────────────┘
```

- 登录 YAML 来源：优先 `yaml_script`（管理页创建时由 AI 生成好），无则依据 `loginUrl/username/password/stepsNlp` 模板化拼接
- 登录阶段缓存 key 独立于 caseId → 跨用例复用

## 三、创建用例页交互

```
选择项目 *  [下拉]
───────────── 登录方式区块（新增，必选）─────────────
○ 不用输入账号密码（免登录）
○ CAS 登录        [角色下拉：管理员(已缓存) / 测试员(未缓存) / ➕ 新建角色]
○ 本地登录        [角色下拉：…]
新建角色表单：名称 / 登录网址 / 账号 / 密码 / 补充步骤NLP
缓存标记：✅ 已执行过，有缓存  |  ⚠️ 未缓存
─────────────────────────────────────────────
NLP 指令模块
YAML 编辑模块
```

- 未选择任一类型 → 执行按钮禁用并报错
- 选中 `none` 后直接进入后续流程
- 角色默认选中"上次执行的角色"（localStorage per project+type）

## 四、插件侧

导出弹窗"项目目录"下新增"登录方式"下拉（数据来自 `GET /login-methods?projectId=`，含"➕ 新建登录方式"选项）；同步 `create-and-execute` 传 `loginMethodId`。

## 五、Prompt（cacheable 规则）

写入 `YamlGeneratorService` system prompt：动态步骤（`[动态]` 标记、日期、图形验证码、短信验证码、随机值）输出 `cacheable: false`；固定值步骤不标记；断言类永不缓存。

## 六、风险

| 风险 | 应对 |
|------|------|
| 登录缓存失效（页面改版） | 官方自动回退 AI 重规划并更新缓存 |
| 登录阶段失败导致报告缺失 | 登录阶段失败信息写入用例报告头部 |
| 老用例（无 loginMethodId）执行 | 兼容：loginMethodId 为空时按免登录执行（向后兼容存量数据） |
