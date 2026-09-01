# 数据迁移指南

## 执行机配置迁移（2026-08）

已有数据库请在部署本版本前执行独立增量脚本
`V20260820__add_execute_service_configuration.sql`。该脚本只执行 `ALTER TABLE ADD COLUMN`，不会删表、重建表或影响历史数据。

执行时按“用户配置 → 项目配置”选择执行机；均为空时接口返回“未配置执行机”。

## 迁移方案

### 源数据
- 路径: `server/data/cases.json`
- 格式: JSON 数组
- 状态值: `pending`, `executing`, `success`, `failed`

### 目标数据
- 数据库: `smart_testing_platform`
- 表: `test_cases`, `projects`, `ai_config`

### 自动迁移
**DataMigrationRunner** 会在 Platform 服务启动时自动执行迁移：

1. 检查 `test_cases` 表是否为空
2. 从 `server/data/cases.json` 加载旧数据
3. 创建默认项目 "测试demo"
4. 逐条迁移用例数据
5. 状态映射: `executing` → `RUNNING`, 其余保持不变

### 状态映射

| 旧状态 | 新状态 |
|--------|--------|
| pending | PENDING |
| executing | RUNNING |
| success | SUCCESS |
| failed | FAILED |

### 手动迁移

如果需要手动迁移，可将 `server/data/cases.json` 复制到:
```
backend/platform-service/src/main/resources/migration/cases.json
```
然后重启 Platform 服务。
