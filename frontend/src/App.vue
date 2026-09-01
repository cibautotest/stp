<template>
  <el-config-provider :locale="zhCn">
    <template v-if="isLoginPage">
      <router-view />
    </template>
    <MainLayout v-else />
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { onMounted } from 'vue'
import { ElConfigProvider } from 'element-plus'
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
import { MainLayout } from '@/components/layout'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const authStore = useAuthStore()

const isLoginPage = computed(() => route.path === '/login')

// 初始化时检查用户登录状态
onMounted(() => {
  authStore.init()
})
</script>

<style lang="scss">
@use './assets/styles/variables.scss' as *;

/* 全局页面切换淡入动画 */
.page-view {
  animation: pageFadeIn 0.3s ease;
}
@keyframes pageFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
