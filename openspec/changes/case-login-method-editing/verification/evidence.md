# 验证证据：case-login-method-editing

## 已完成验证（2026-10-16）

| 项 | 结果 | 证据 |
|---|---|---|
| 后端编译 `mvn -q -pl platform-service -am compile -DskipTests` | 通过 | COMPILE_EXIT=0 |
| 单元测试 `mvn -q -pl platform-service test -Dtest=LoginMethodServiceTest` | 5/5 通过 | TEST_EXIT=0 |
| 前端 `read_lints`（views/detail/index.vue） | 零错误 | totalCount=0 |
| 前端完整构建 `npm run build` | 通过 | ✓ built in 37.86s，BUILD_EXIT=0（chunk >500kB 警告为既有问题） |

## 未验证项（用户自行测试）

按用户指示，运行时验证由用户执行：
- 详情页登录方式弹窗的换绑/解绑/编辑/新建/删除全流程（自测清单见 test-cases.md A1-A7）
- 修改登录信息后 cacheStatus 重置为 uncached 的实际效果（A2/A7）
- 本地平台跑在旧 Docker 镜像（stp-platform/stp-frontend），需重建镜像/重新部署后自测
