import { createRouter, createWebHashHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('@/views/profile/index.vue'),
    meta: { title: '个人设置', icon: 'User' }
  },
  {
    path: '/project-settings',
    name: 'ProjectSettings',
    component: () => import('@/views/project-settings/index.vue'),
    meta: { title: '项目设置', icon: 'Setting' }
  },
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { title: '登录', hidden: true }
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('@/views/home/index.vue'),
    meta: { title: '首页', icon: 'HomeFilled' }
  },
  {
    path: '/create',
    name: 'Create',
    component: () => import('@/views/create/index.vue'),
    meta: { title: '创建测试', icon: 'Plus' }
  },
  {
    path: '/cases',
    name: 'Cases',
    component: () => import('@/views/cases/index.vue'),
    meta: { title: '用例管理', icon: 'Document' }
  },
  {
    path: '/plans',
    name: 'Plans',
    component: () => import('@/views/plans/index.vue'),
    meta: { title: '测试计划', icon: 'List' }
  },
  {
    path: '/detail/:id',
    name: 'Detail',
    component: () => import('@/views/detail/index.vue'),
    meta: { title: '用例详情', hidden: true }
  },
  {
    path: '/config',
    name: 'Config',
    component: () => import('@/views/config/index.vue'),
    meta: { title: '参数配置', icon: 'Setting', requiresAuth: true, role: 'sysadmin' }
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/views/users/index.vue'),
    meta: { title: '用户管理', icon: 'UserFilled', requiresAuth: true, role: 'sysadmin' }
  },
  {
    path: '/reports',
    name: 'Reports',
    component: () => import('@/views/reports/index.vue'),
    meta: { title: '报告中心', icon: 'Tickets' }
  },
  {
    path: '/fault-simulation',
    name: 'FaultSimulation',
    component: () => import('@/views/fault-simulation/index.vue'),
    meta: { title: '故障模拟', icon: 'WarningFilled' }
  },
  {
    path: '/plugins',
    name: 'Plugins',
    component: () => import('@/views/plugins/index.vue'),
    meta: { title: '插件中心', icon: 'Download' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()
  if (!authStore.initialized) {
    await authStore.init()
  }

  if (to.path === '/login') {
    if (authStore.isAuthenticated) {
      next('/home')
    } else {
      next()
    }
    return
  }

  if (!authStore.isAuthenticated) {
    next('/login')
    return
  }

  if (to.meta.role === 'sysadmin' && !authStore.isSysadmin) {
    next('/home')
    return
  }

  next()
})

export default router
