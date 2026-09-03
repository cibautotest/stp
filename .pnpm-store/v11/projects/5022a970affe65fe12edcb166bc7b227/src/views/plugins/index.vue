<template>
  <div class="plugins-view">
    <!-- 插件信息卡片 -->
    <el-row :gutter="20">
      <el-col :span="24">
        <div class="plugin-hero">
          <div class="plugin-hero-icon">
            <el-icon :size="48"><svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/></svg></el-icon>
          </div>
          <div class="plugin-hero-content">
            <h2>可视化测试插件</h2>
            <p class="plugin-desc">
              基于 AI 的网页自动化测试工具，支持自然语言操控网页、录制操作步骤、一键导出测试用例到智能测试平台。
            </p>
            <div class="plugin-hero-bottom">
              <div class="plugin-meta">
                <el-tag type="primary" effect="dark">版本 v1.92</el-tag>
                <el-tag effect="dark">Chrome 扩展</el-tag>
                <el-tag type="info" effect="dark">Manifest V3</el-tag>
              </div>
              <el-button class="download-btn" size="large" round @click="downloadExtension">
                <el-icon><Download /></el-icon>
                下载扩展
              </el-button>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 安装步骤 -->
    <el-row :gutter="20" style="margin-top: 20px;" class="install-row">
      <el-col :span="16">
        <div class="config-card">
          <h3 class="card-title">
            <el-icon><Download /></el-icon>
            安装步骤
          </h3>

          <el-steps direction="vertical" :active="999" class="install-steps">
            <el-step>
              <template #title>
                <span class="step-title">第 1 步：打开 Chrome 扩展程序管理页面</span>
              </template>
              <template #description>
                <div class="step-desc">
                  在 Chrome 浏览器地址栏输入
                  <el-tag effect="dark" round> chrome://extensions/ </el-tag>
                  并回车
                </div>
              </template>
            </el-step>

            <el-step>
              <template #title>
                <span class="step-title">第 2 步：开启开发者模式</span>
              </template>
              <template #description>
                <div class="step-desc">
                  在扩展程序页面右上角，打开<strong>「开发者模式」</strong>开关
                  <el-tooltip content="此开关在页面右上角" placement="top">
                    <el-icon class="tip-icon"><QuestionFilled /></el-icon>
                  </el-tooltip>
                </div>
              </template>
            </el-step>

            <el-step>
              <template #title>
                <span class="step-title">第 3 步：解压并加载插件</span>
              </template>
              <template #description>
                <div class="step-desc">
                  <p>1. 下载完成后，找到下载的 <strong>可视化测试插件.zip</strong> 文件并<strong>解压</strong></p>
                  <p>2. 点击 Chrome 扩展程序页面左上角的<strong>「加载已解压的扩展程序」</strong>按钮</p>
                  <p>3. 在弹出的文件选择对话框中，<strong>选择解压后的文件夹</strong>：</p>
                  <div class="folder-path">
                    <el-tag effect="dark" type="warning" size="large">
                      <el-icon><FolderOpened /></el-icon>
                      &nbsp;可视化测试插件
                    </el-tag>
                  </div>
                  <p class="path-hint">
                    解压 <code>可视化测试插件.zip</code> 后，选择解压出的 <code>自定义保存路径\可视化测试插件</code> 文件夹
                  </p>
                </div>
              </template>
            </el-step>

            <el-step>
              <template #title>
                <span class="step-title">第 4 步：固定插件到工具栏</span>
              </template>
              <template #description>
                <div class="step-desc">
                  安装完成后，点击 Chrome 工具栏右侧的扩展程序图标，找到插件并点击<strong>图钉</strong>将其固定
                </div>
              </template>
            </el-step>

            <el-step>
              <template #title>
                <span class="step-title">第 5 步：开始使用</span>
              </template>
              <template #description>
                <div class="step-desc">
                  <ol class="usage-list">
                    <li>点击工具栏中的插件图标，展开侧边栏面板</li>
                    <li>在输入框中用自然语言描述测试步骤（如"点击登录按钮"）</li>
                    <li>完成全部测试步骤后，点击顶部<strong>「导出全量用例步骤」</strong>按钮</li>
                    <li>填写<strong>项目名称、用例名称、中台账号、密码</strong>，勾选需要的步骤</li>
                    <li>点击<strong>「生成用例」</strong>，用例将自动同步到中台</li>
                  </ol>
                </div>
              </template>
            </el-step>
          </el-steps>
        </div>
      </el-col>

      <!-- 右侧提示（高度不超过安装步骤） -->
      <el-col :span="8">
        <div class="right-panel">
          <div class="config-card tips-card">
            <h3 class="card-title">
              <el-icon><InfoFilled /></el-icon>
              使用提示
            </h3>
            <div class="tips-content">
              <el-alert
                title="中台地址配置"
                type="info"
                :closable="false"
                show-icon
                style="margin-bottom: 10px;"
              >
                <p>插件默认连接 <code>http://localhost:8081</code></p>
                <p>如需修改，在插件 Console 中执行：</p>
                <code style="display:block;margin-top:4px;background:#f5f7fa;padding:4px 8px;border-radius:4px;font-size:12px;">
                  localStorage.setItem('midscene_platform_url', '你的地址')
                </code>
              </el-alert>

              <el-alert
                title="登录态说明"
                type="warning"
                :closable="false"
                show-icon
                style="margin-bottom: 10px;"
              >
                <p style="font-size:12px;">v1 版本中，插件导出的是<strong>测试步骤</strong>，不含登录信息</p>
                <p style="font-size:12px;">如需在平台执行，请在 YAML 中补充登录步骤</p>
              </el-alert>

              <el-alert
                title="自动登录"
                type="success"
                :closable="false"
                show-icon
              >
                <p style="font-size:12px;">插件使用<strong>中台账号密码</strong>自动登录</p>
                <p style="font-size:12px;">无需手动填写 Token</p>
              </el-alert>
            </div>
          </div>

          <div class="config-card faq-card">
            <h3 class="card-title">
              <el-icon><VideoCameraFilled /></el-icon>
              常见问题
            </h3>
            <div class="faq-scroll">
              <el-collapse>
                <el-collapse-item title="插件安装后看不到侧边栏？" name="1">
                  <p style="font-size:12px;">点击工具栏扩展图标 → 找到插件 → 点击即可展开侧边栏</p>
                </el-collapse-item>
                <el-collapse-item title='提示"扩展冲突"？' name="2">
                  <p style="font-size:12px;">请暂时关闭其他可能影响网页的扩展，刷新页面后重试</p>
                </el-collapse-item>
                <el-collapse-item title='生成用例提示"登录失败"？' name="3">
                  <p style="font-size:12px;">检查：① 中台是否已启动 (8081)；② 账号密码是否正确；③ 账号是否被禁用</p>
                </el-collapse-item>
                <el-collapse-item title='执行用例时提示离线？' name="4">
                  <p style="font-size:12px;">execute-service (3001) 可能未启动，用例已保存，可稍后手动执行</p>
                </el-collapse-item>
              </el-collapse>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import {
  Download, InfoFilled, QuestionFilled,
  FolderOpened, VideoCameraFilled
} from '@element-plus/icons-vue'

const downloadExtension = () => {
  const link = document.createElement('a')
  link.href = '/plugin/midscene-extension.zip'
  link.download = '可视化测试插件.zip'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  ElMessage.success('开始下载扩展包')
}
</script>

<style lang="scss" scoped>
.plugins-view {
  max-width: 1200px;
  margin: 0 auto;
}

// Make both columns equal height (right matches left's content height)
.install-row {
  align-items: stretch;

  :deep(.el-col) {
    > * {
      height: 100%;
    }
  }
}

.plugin-hero {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 28px 32px;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 24px;

  .plugin-hero-icon {
    flex-shrink: 0;
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    backdrop-filter: blur(4px);
  }

  .plugin-hero-content {
    flex: 1;

    h2 {
      margin: 0 0 6px;
      font-size: 22px;
      font-weight: 600;
    }

    .plugin-desc {
      margin: 0 0 16px;
      font-size: 13px;
      opacity: 0.9;
      line-height: 1.6;
      max-width: 640px;
    }

    .plugin-hero-bottom {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .plugin-meta {
      display: flex;
      gap: 8px;
    }

    .download-btn {
      background: #fff;
      color: #764ba2;
      border: none;
      font-weight: 600;

      &:hover {
        background: #f0e6ff;
        color: #5a2d8a;
      }
    }
  }
}

.config-card {
  background: #fff;
  border-radius: 8px;
  padding: 40px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);

  .card-title {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: #1f2937;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 12px;
    border-bottom: 1px solid #f0f0f0;
  }
}

.right-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.tips-card {
  flex-shrink: 0;
}

.faq-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .faq-scroll {
    flex: 1;
    overflow-y: auto;
    min-height: 50px;
    padding-right: 4px;

    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 2px;
    }
  }
}

.install-steps {
  .step-title {
    font-size: 15px;
    font-weight: 500;
    color: #1f2937;
  }

  .step-desc {
    font-size: 13px;
    color: #606266;
    line-height: 1.8;
    padding: 8px 0;
    overflow-wrap: break-word;
    word-break: break-word;

    p { margin: 4px 0; }

    .folder-path {
      margin: 12px 0;
    }

    .path-hint {
      font-size: 12px;
      color: #909399;
      margin-top: 8px;
      overflow-wrap: break-word;
      word-break: break-word;

      code {
        background: #f5f7fa;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 12px;
        word-break: break-all;
        overflow-wrap: anywhere;
      }
    }

    .tip-icon {
      margin-left: 4px;
      color: #909399;
      cursor: help;
    }
  }
}

.usage-list {
  margin: 4px 0;
  padding-left: 20px;

  li {
    padding: 4px 0;
  }
}

.tips-content {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;

  :deep(.el-alert__description) {
    margin-top: 4px;
  }
}
</style>
