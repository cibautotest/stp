<template>
  <div class="users-view">
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="title">用户管理</span>
      </div>
      <div class="toolbar-right">
        <el-button type="primary" @click="openCreateDialog">
          <el-icon><Plus /></el-icon>创建用户
        </el-button>
        <el-button @click="fetchUsers">
          <el-icon><Refresh /></el-icon>刷新
        </el-button>
      </div>
    </div>

    <div class="users-list">
      <el-table v-loading="loading" :data="users" stripe class="users-table">
        <el-table-column prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="displayName" label="显示名称" min-width="140" />
        <el-table-column prop="role" label="角色" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.role === 'sysadmin' ? 'warning' : 'info'" size="small">
              {{ row.role === 'sysadmin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="lastLoginAt" label="最后登录" width="170" align="center">
          <template #default="{ row }">{{ row.lastLoginAt ? formatTime(row.lastLoginAt) : '-' }}</template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="170" align="center">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button type="success" link size="small" @click="openPermissionDialog(row)">权限</el-button>
            <el-button type="warning" link size="small" @click="openResetPassword(row)">重置密码</el-button>
            <el-button v-if="row.username !== 'sysadmin'" type="danger" link size="small" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > 0" class="pagination-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="fetchUsers"
          @size-change="fetchUsers"
        />
      </div>
    </div>

    <!-- 创建/编辑用户弹窗 -->
    <el-dialog
      v-model="showUserDialog"
      :title="isEditing ? '编辑用户' : '创建用户'"
      width="500px"
      :destroy-on-close="true"
    >
      <el-form ref="userFormRef" :model="userForm" :rules="userRules" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userForm.username" :disabled="isEditing" placeholder="2-64位字母/数字" />
        </el-form-item>
        <el-form-item v-if="!isEditing" label="密码" prop="password">
          <el-input v-model="userForm.password" type="password" show-password placeholder="至少6位" />
        </el-form-item>
        <el-form-item label="显示名称" prop="displayName">
          <el-input v-model="userForm.displayName" placeholder="用户显示名称" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="userForm.role" class="full-width">
            <el-option label="普通用户 (general)" value="general" />
            <el-option label="管理员 (sysadmin)" value="sysadmin" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-switch v-model="userForm.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
        <el-form-item label="执行机地址" prop="executeServiceUrl">
          <el-input v-model="userForm.executeServiceUrl" placeholder="http://execute.example.com:3001；留空则使用项目配置" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showUserDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveUser">保存</el-button>
      </template>
    </el-dialog>

    <!-- 权限分配弹窗 -->
    <el-dialog
      v-model="showPermissionDialog"
      title="分配项目权限"
      width="600px"
      :destroy-on-close="true"
    >
      <div v-if="permissionUser" class="perm-header">
        <span class="perm-user-label">用户: {{ permissionUser.displayName || permissionUser.username }}</span>
      </div>
      <el-tree
        ref="treeRef"
        :data="allProjects"
        :props="{ label: 'name', disabled: () => false }"
        :default-checked-keys="assignedProjectIds"
        node-key="id"
        show-checkbox
        class="perm-tree"
      />
      <template #footer>
        <el-button @click="showPermissionDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingPerm" @click="handleSavePermission">保存权限</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码弹窗 -->
    <el-dialog
      v-model="showPasswordDialog"
      title="重置密码"
      width="400px"
      :destroy-on-close="true"
    >
      <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="100px">
        <el-form-item label="新密码" prop="password">
          <el-input v-model="pwdForm.password" type="password" show-password placeholder="至少6位" />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingPwd" @click="handleSavePassword">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import {
  getUsers, createUser, updateUser, deleteUser,
  resetPassword, getUserProjects, assignUserProjects, getAllProjects
} from '@/api'
import type { UserVO } from '@/api/users'
import { formatDate } from '@/utils'

const users = ref<UserVO[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)

// 创建/编辑用户弹窗
const showUserDialog = ref(false)
const isEditing = ref(false)
const editingUserId = ref<number | null>(null)
const saving = ref(false)
const userFormRef = ref()
const userForm = reactive({
  username: '',
  password: '',
  displayName: '',
  role: 'general',
  status: 1,
  executeServiceUrl: ''
})
const userRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 2, max: 64, message: '长度在 2 到 64 个字符', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

// 权限分配
const showPermissionDialog = ref(false)
const permissionUser = ref<UserVO | null>(null)
const allProjects = ref<any[]>([])
const assignedProjectIds = ref<string[]>([])
const treeRef = ref()
const savingPerm = ref(false)

// 重置密码
const showPasswordDialog = ref(false)
const passwordUserId = ref<number | null>(null)
const savingPwd = ref(false)
const pwdFormRef = ref()
const pwdForm = reactive({
  password: '',
  confirmPassword: ''
})
const pwdRules = {
  password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: Function) => {
        if (value !== pwdForm.password) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 获取用户列表
const fetchUsers = async () => {
  loading.value = true
  try {
    const res: any = await getUsers({ page: currentPage.value, size: pageSize.value })
    const data = res || res as any
    if (data && data.items) {
      users.value = data.items
      total.value = data.total || 0
    }
  } catch (error) {
    console.error('获取用户列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 打开创建用户弹窗
const openCreateDialog = () => {
  isEditing.value = false
  editingUserId.value = null
  userForm.username = ''
  userForm.password = ''
  userForm.displayName = ''
  userForm.role = 'general'
  userForm.status = 1
  userForm.executeServiceUrl = ''
  showUserDialog.value = true
}

// 打开编辑用户弹窗
const openEditDialog = (row: UserVO) => {
  isEditing.value = true
  editingUserId.value = row.id
  userForm.username = row.username
  userForm.password = ''
  userForm.displayName = row.displayName || ''
  userForm.role = row.role
  userForm.status = row.status
  userForm.executeServiceUrl = row.executeServiceUrl || ''
  // 编辑时密码非必填
  userRules.password = []
  showUserDialog.value = true
}

// 保存用户
const handleSaveUser = async () => {
  if (!userFormRef.value) return
  await userFormRef.value.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      if (isEditing.value && editingUserId.value) {
        await updateUser(editingUserId.value, {
          displayName: userForm.displayName,
          role: userForm.role,
          status: userForm.status,
          executeServiceUrl: userForm.executeServiceUrl
        })
        ElMessage.success('更新成功')
      } else {
        await createUser({
          username: userForm.username,
          password: userForm.password,
          displayName: userForm.displayName,
          role: userForm.role,
          status: userForm.status,
          executeServiceUrl: userForm.executeServiceUrl
        })
        ElMessage.success('创建成功')
      }
      showUserDialog.value = false
      await fetchUsers()
    } catch (error: any) {
      ElMessage.error(error?.message || '操作失败')
    } finally {
      saving.value = false
    }
  })
}

// 删除用户
const handleDelete = async (row: UserVO) => {
  try {
    await ElMessageBox.confirm(`确定删除用户"${row.username}"吗？`, '删除确认', { type: 'warning' })
    await deleteUser(row.id)
    ElMessage.success('删除成功')
    await fetchUsers()
  } catch (e: any) {
    if (e !== 'cancel') ElMessage.error('删除失败')
  }
}

// 打开权限分配弹窗
const openPermissionDialog = async (row: UserVO) => {
  permissionUser.value = row
  showPermissionDialog.value = true
  savingPerm.value = true
  try {
    const projectsRes: any = await getAllProjects()
    allProjects.value = Array.isArray(projectsRes) ? projectsRes : (projectsRes?.data || [])
    const permRes: any = await getUserProjects(row.id)
    assignedProjectIds.value = permRes?.projectIds || []
  } catch (error) {
    console.error('获取权限数据失败:', error)
  } finally {
    savingPerm.value = false
  }
}

// 保存权限
const handleSavePermission = async () => {
  if (!permissionUser.value) return
  savingPerm.value = true
  try {
    // 从树组件获取当前选中的节点
    const checkedKeys = treeRef.value?.getCheckedKeys() || []
    const halfCheckedKeys = treeRef.value?.getHalfCheckedKeys() || []
    const allKeys = [...checkedKeys, ...halfCheckedKeys]
    await assignUserProjects(permissionUser.value.id, allKeys)
    ElMessage.success('权限保存成功')
    showPermissionDialog.value = false
  } catch (error: any) {
    ElMessage.error(error?.message || '保存权限失败')
  } finally {
    savingPerm.value = false
  }
}

// 打开重置密码弹窗
const openResetPassword = (row: UserVO) => {
  passwordUserId.value = row.id
  pwdForm.password = ''
  pwdForm.confirmPassword = ''
  showPasswordDialog.value = true
}

// 保存密码
const handleSavePassword = async () => {
  if (!pwdFormRef.value) return
  await pwdFormRef.value.validate(async (valid: boolean) => {
    if (!valid || !passwordUserId.value) return
    savingPwd.value = true
    try {
      await resetPassword(passwordUserId.value, pwdForm.password)
      ElMessage.success('密码重置成功')
      showPasswordDialog.value = false
    } catch (error: any) {
      ElMessage.error(error?.message || '重置密码失败')
    } finally {
      savingPwd.value = false
    }
  })
}

const formatTime = (d: string) => d ? formatDate(d, 'YYYY-MM-DD HH:mm') : '-'

onMounted(() => {
  fetchUsers()
})
</script>

<style lang="scss" scoped>
.users-view {
  .toolbar {
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
    background: #fff; padding: 16px 20px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    .toolbar-left, .toolbar-right { display: flex; align-items: center; gap: 12px; }
    .title { font-size: 18px; font-weight: 600; color: #303133; }
  }
  .users-list {
    background: #fff; border-radius: 8px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08);
    .users-table {
      :deep(.el-table__header th) { background: #f5f7fa; }
    }
    .pagination-wrap { display: flex; justify-content: center; padding: 20px 0; }
  }
  .full-width { width: 100%; }
  .perm-header {
    margin-bottom: 16px;
    .perm-user-label { font-size: 15px; font-weight: 600; color: #303133; }
  }
  .perm-tree {
    border: 1px solid #e8ecf1; border-radius: 8px; padding: 12px;
    max-height: 400px; overflow-y: auto;
  }
}
</style>
