<template>
  <el-container class="main-layout">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapsed ? '64px' : '220px'" class="sidebar">
      <div class="logo">
        <span v-if="!isCollapsed">智能测试平台</span>
        <span v-else>测试</span>
      </div>
      <el-menu
        :default-active="route.path"
        :collapse="isCollapsed"
        :collapse-transition="false"
        class="sidebar-menu"
      >
        <el-menu-item index="/home" @click="navigate('/home')">
          <el-icon><HomeFilled /></el-icon>
          <template #title>首页</template>
        </el-menu-item>
        <el-menu-item index="/create" @click="navigate('/create')">
          <el-icon><Plus /></el-icon>
          <template #title>创建测试</template>
        </el-menu-item>
        <el-menu-item index="/cases" @click="navigate('/cases')">
          <el-icon><Document /></el-icon>
          <template #title>用例管理</template>
        </el-menu-item>
        <el-menu-item index="/plans" @click="navigate('/plans')">
          <el-icon><List /></el-icon>
          <template #title>测试计划</template>
        </el-menu-item>
        <el-menu-item index="/reports" @click="navigate('/reports')">
          <el-icon><Tickets /></el-icon>
          <template #title>报告中心</template>
        </el-menu-item>
        <el-menu-item index="/fault-simulation" @click="navigate('/fault-simulation')">
          <el-icon><WarningFilled /></el-icon>
          <template #title>故障模拟</template>
        </el-menu-item>
        <el-menu-item index="/plugins" @click="navigate('/plugins')">
          <el-icon><Download /></el-icon>
          <template #title>插件中心</template>
        </el-menu-item>
        <el-menu-item index="/project-settings" @click="navigate('/project-settings')">
          <el-icon><Setting /></el-icon>
          <template #title>项目设置</template>
        </el-menu-item>
        <el-menu-item index="/profile" @click="navigate('/profile')">
          <el-icon><User /></el-icon>
          <template #title>个人设置</template>
        </el-menu-item>
        <el-menu-item v-if="authStore.isSysadmin" index="/users" @click="navigate('/users')">
          <el-icon><UserFilled /></el-icon>
          <template #title>用户管理</template>
        </el-menu-item>
        <el-menu-item v-if="authStore.isSysadmin" index="/config" @click="navigate('/config')">
          <el-icon><Setting /></el-icon>
          <template #title>参数配置</template>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer">
        <span v-if="!isCollapsed" class="footer-text">如有疑问请联系中台负责人<br/>唐天野、田少聪、李玮</span>
        <span v-else class="footer-text-short">联系<br/>负责人</span>
      </div>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="toggleCollapse">
            <Fold v-if="!isCollapsed" />
            <Expand v-else />
          </el-icon>
        </div>
        <div class="header-right">
          <span class="header-title">{{ currentRouteTitle }}</span>
          <el-select v-model="currentProjectId" class="current-project" placeholder="选择当前项目" @change="changeProject">
            <el-option v-for="project in projectStore.projects" :key="project.id" :label="project.name" :value="project.id" />
          </el-select>
          <el-dropdown v-if="authStore.isAuthenticated" class="user-dropdown" @command="handleCommand">
            <span class="user-info">
              <el-icon><UserFilled /></el-icon>
              <span class="user-name">{{ authStore.user?.displayName || authStore.user?.username }}</span>
              <el-tag v-if="authStore.isSysadmin" size="small" type="warning" effect="dark">管理员</el-tag>
              <el-tag v-else size="small" type="info" effect="plain">用户</el-tag>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>个人设置
                </el-dropdown-item>
                <el-dropdown-item command="logout">
                  <el-icon><SwitchButton /></el-icon>退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main-content">
        <router-view :key="route.fullPath" class="page-view" />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  HomeFilled, Plus, Document, List, Setting,
  Tickets, UserFilled, User, SwitchButton, Fold, Expand, Download, WarningFilled
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useProjectStore } from '@/stores/project'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()
const isCollapsed = ref(false)
const currentProjectId = computed({
  get: () => projectStore.currentProject?.id || '',
  set: (id: string) => projectStore.selectProject(projectStore.projects.find(p => p.id === id) || null)
})

const currentRouteTitle = computed(() => {
  return (route.meta?.title as string) || ''
})

const navigate = (path: string) => {
  if (route.path !== path) {
    router.push(path)
  }
}

const toggleCollapse = () => {
  isCollapsed.value = !isCollapsed.value
}
const changeProject = (id: string) => projectStore.selectProject(projectStore.projects.find(p => p.id === id) || null)
onMounted(() => {
  if (authStore.isAuthenticated) {
    projectStore.fetchProjects()
  }
})

const handleCommand = async (command: string) => {
  if (command === 'profile') {
    router.push('/profile')
    return
  }
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '退出确认', { type: 'info' })
      authStore.logout()
      ElMessage.success('已退出登录')
    } catch { /* 取消 */ }
  }
}
</script>

<style lang="scss" scoped>
.main-layout {
  height: 100vh;
}

.sidebar {
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  transition: width 0.3s;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  .logo {
    height: 60px;
    line-height: 60px;
    text-align: center;
    color: #fff;
    font-size: 18px;
    font-weight: 600;
    letter-spacing: 2px;
    background: rgba(255, 255, 255, 0.05);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .sidebar-menu {
    border-right: none;
    background: transparent;
    flex: 1;

    :deep(.el-menu-item) {
      color: rgba(255, 255, 255, 0.7);
      height: 56px;
      line-height: 56px;

      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
      }

      &.is-active {
        background: linear-gradient(90deg, #409eff, #53a8ff);
        color: #fff;
      }

      .el-icon {
        color: inherit;
      }
    }
  }

  .sidebar-footer {
    padding: 12px 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    .footer-text {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
      line-height: 1.6;
      text-align: center;
      display: block;
    }
    .footer-text-short {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.4);
      line-height: 1.4;
      text-align: center;
      display: block;
    }
  }
}

.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  z-index: 10;
  height: 60px;

  .collapse-btn {
    font-size: 20px;
    cursor: pointer;
    color: #606266;

    &:hover { color: #409eff; }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .header-title {
    font-size: 16px;
    font-weight: 500;
    color: #303133;
    padding-right: 4px;
  }
  .current-project { width: 210px; }

  .user-info {
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;

    .user-name {
      font-size: 14px;
      color: #606266;
    }
  }
}

.main-content {
  background: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
  min-height: calc(100vh - 60px);
}
</style>
