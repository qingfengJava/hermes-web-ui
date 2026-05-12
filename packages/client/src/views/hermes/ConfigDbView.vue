<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import {
  NButton, NTabPane, NTabs, NDataTable, NModal, NForm, NFormItem,
  NInput, NSwitch, NSelect, NTag, NPopconfirm, NSpin, NCard,
  NGrid, NGi, NInputNumber, NText, useMessage, NDivider
} from 'naive-ui'
import {
  listConfigDb, createConfigDb, updateConfigDb, deleteConfigDb,
  type DbRecord
} from '@/api/hermes/config-db'

const message = useMessage()

// ── 表定义 ──────────────────────────────────────────

interface TableMeta {
  key: string
  label: string
  columns: { key: string; title: string; width?: number; type?: 'bool' | 'json' | 'number' }[]
  editableFields: { key: string; label: string; type: 'text' | 'bool' | 'number' | 'select'; options?: { label: string; value: string }[] }[]
}

const tableMetas: TableMeta[] = [
  {
    key: 'agent_settings',
    label: 'Agent 设置',
    columns: [
      { key: 'id', title: 'ID', width: 100 },
      { key: 'setting_key', title: '配置键', width: 200 },
      { key: 'setting_value', title: '配置值', width: 200 },
      { key: 'updated_at', title: '更新时间', width: 180 },
    ],
    editableFields: [
      { key: 'setting_key', label: '配置键', type: 'text' },
      { key: 'setting_value', label: '配置值', type: 'text' },
    ],
  },
  {
    key: 'model_configs',
    label: '模型配置',
    columns: [
      { key: 'id', title: 'ID', width: 100 },
      { key: 'model_name', title: '模型名称', width: 200 },
      { key: 'provider_key', title: '供应商', width: 120 },
      { key: 'is_default', title: '默认', width: 70, type: 'bool' },
      { key: 'enabled', title: '启用', width: 70, type: 'bool' },
      { key: 'max_tokens', title: '最大 Token', width: 100 },
      { key: 'updated_at', title: '更新时间', width: 180 },
    ],
    editableFields: [
      { key: 'model_name', label: '模型名称', type: 'text' },
      { key: 'provider_key', label: '供应商 Key', type: 'text' },
      { key: 'max_tokens', label: '最大 Token', type: 'number' },
      { key: 'temperature', label: '温度', type: 'number' },
      { key: 'top_p', label: 'Top P', type: 'number' },
      { key: 'is_default', label: '设为默认', type: 'bool' },
      { key: 'enabled', label: '启用', type: 'bool' },
    ],
  },
  {
    key: 'provider_configs',
    label: '供应商配置',
    columns: [
      { key: 'id', title: 'ID', width: 100 },
      { key: 'provider_key', title: '供应商 Key', width: 120 },
      { key: 'display_name', title: '显示名称', width: 120 },
      { key: 'api_mode', title: 'API 模式', width: 120 },
      { key: 'base_url', title: 'Base URL', width: 200 },
      { key: 'enabled', title: '启用', width: 70, type: 'bool' },
      { key: 'updated_at', title: '更新时间', width: 180 },
    ],
    editableFields: [
      { key: 'provider_key', label: '供应商 Key', type: 'text' },
      { key: 'display_name', label: '显示名称', type: 'text' },
      { key: 'api_mode', label: 'API 模式', type: 'select', options: [
        { label: 'chat_completions', value: 'chat_completions' },
        { label: 'responses', value: 'responses' },
      ]},
      { key: 'base_url', label: 'Base URL', type: 'text' },
      { key: 'auth_type', label: '认证方式', type: 'select', options: [
        { label: 'api_key', value: 'api_key' },
        { label: 'bearer', value: 'bearer' },
        { label: 'oauth', value: 'oauth' },
      ]},
      { key: 'env_var_name', label: '环境变量名', type: 'text' },
      { key: 'enabled', label: '启用', type: 'bool' },
    ],
  },
  {
    key: 'toolset_configs',
    label: '工具集配置',
    columns: [
      { key: 'id', title: 'ID', width: 100 },
      { key: 'platform', title: '平台', width: 100 },
      { key: 'toolset_name', title: '工具集名称', width: 160 },
      { key: 'enabled', title: '启用', width: 70, type: 'bool' },
      { key: 'updated_at', title: '更新时间', width: 180 },
    ],
    editableFields: [
      { key: 'platform', label: '平台', type: 'select', options: [
        { label: 'cli', value: 'cli' },
        { label: 'web', value: 'web' },
        { label: 'telegram', value: 'telegram' },
        { label: 'all', value: 'all' },
      ]},
      { key: 'toolset_name', label: '工具集名称', type: 'text' },
      { key: 'enabled', label: '启用', type: 'bool' },
    ],
  },
  {
    key: 'skill_configs',
    label: '技能配置',
    columns: [
      { key: 'id', title: 'ID', width: 100 },
      { key: 'skill_path', title: '技能路径', width: 200 },
      { key: 'platform', title: '平台', width: 100 },
      { key: 'enabled', title: '启用', width: 70, type: 'bool' },
      { key: 'pinned', title: '置顶', width: 70, type: 'bool' },
      { key: 'updated_at', title: '更新时间', width: 180 },
    ],
    editableFields: [
      { key: 'skill_path', label: '技能路径', type: 'text' },
      { key: 'platform', label: '平台', type: 'select', options: [
        { label: 'all', value: 'all' },
        { label: 'cli', value: 'cli' },
        { label: 'web', value: 'web' },
      ]},
      { key: 'enabled', label: '启用', type: 'bool' },
      { key: 'pinned', label: '置顶', type: 'bool' },
    ],
  },
  {
    key: 'platform_configs',
    label: '平台配置',
    columns: [
      { key: 'id', title: 'ID', width: 100 },
      { key: 'platform', title: '平台', width: 120 },
      { key: 'config_key', title: '配置键', width: 160 },
      { key: 'config_value', title: '配置值', width: 200 },
      { key: 'is_secret', title: '加密', width: 70, type: 'bool' },
      { key: 'updated_at', title: '更新时间', width: 180 },
    ],
    editableFields: [
      { key: 'platform', label: '平台', type: 'select', options: [
        { label: 'telegram', value: 'telegram' },
        { label: 'discord', value: 'discord' },
        { label: 'slack', value: 'slack' },
        { label: 'whatsapp', value: 'whatsapp' },
        { label: 'matrix', value: 'matrix' },
      ]},
      { key: 'config_key', label: '配置键', type: 'text' },
      { key: 'config_value', label: '配置值', type: 'text' },
      { key: 'is_secret', label: '加密字段', type: 'bool' },
    ],
  },
]

// ── 状态 ──────────────────────────────────────────────

const activeTab = ref('agent_settings')
const tableData = ref<Record<string, DbRecord[]>>({})
const loading = ref(false)
const showModal = ref(false)
const editingRecord = ref<DbRecord | null>(null)
const editingTable = ref('')
const formData = ref<Record<string, any>>({})
const submitting = ref(false)
const error = ref('')

const currentMeta = computed(() => tableMetas.find(m => m.key === activeTab.value)!)

// ── 数据加载 ──────────────────────────────────────────

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const res = await listConfigDb(activeTab.value)
    if (res.success) {
      tableData.value[activeTab.value] = res.data
    } else {
      error.value = (res as any).error || '加载失败'
    }
  } catch (e: any) {
    error.value = e.message || '网络错误'
  } finally {
    loading.value = false
  }
}

function handleTabChange(key: string) {
  activeTab.value = key
  if (!tableData.value[key]) {
    loadData()
  }
}

onMounted(() => {
  loadData()
})

// ── CRUD 操作 ──────────────────────────────────────────

function openCreate() {
  editingRecord.value = null
  editingTable.value = activeTab.value
  formData.value = {}
  showModal.value = true
}

function openEdit(row: DbRecord) {
  editingRecord.value = row
  editingTable.value = activeTab.value
  formData.value = { ...row }
  showModal.value = true
}

async function handleSubmit() {
  submitting.value = true
  try {
    const meta = tableMetas.find(m => m.key === editingTable.value)!
    const data: Record<string, any> = {}
    for (const field of meta.editableFields) {
      if (formData.value[field.key] !== undefined && formData.value[field.key] !== '') {
        data[field.key] = formData.value[field.key]
      }
    }

    if (editingRecord.value) {
      const res = await updateConfigDb(editingTable.value, editingRecord.value.id, data)
      if (res.success) {
        message.success('更新成功')
        showModal.value = false
        loadData()
      } else {
        message.error((res as any).error || '更新失败')
      }
    } else {
      const res = await createConfigDb(editingTable.value, data)
      if (res.success) {
        message.success('创建成功')
        showModal.value = false
        loadData()
      } else {
        message.error((res as any).error || '创建失败')
      }
    }
  } catch (e: any) {
    message.error(e.message || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: DbRecord) {
  try {
    const res = await deleteConfigDb(activeTab.value, row.id)
    if (res.success) {
      message.success('删除成功')
      loadData()
    } else {
      message.error((res as any).error || '删除失败')
    }
  } catch (e: any) {
    message.error(e.message || '删除失败')
  }
}

// ── 格式化 ──────────────────────────────────────────────

function formatTimestamp(val: any): string {
  if (!val) return '-'
  const num = typeof val === 'number' ? val : parseInt(val, 10)
  if (isNaN(num)) return String(val)
  return new Date(num).toLocaleString('zh-CN')
}

function formatValue(val: any, type?: string): string {
  if (val === null || val === undefined) return '-'
  if (type === 'bool') return val ? '✅' : '❌'
  if (type === 'json' && typeof val === 'object') return JSON.stringify(val)
  if (typeof val === 'string' && val.length > 60) return val.slice(0, 60) + '...'
  return String(val)
}
</script>

<template>
  <div class="config-db-view">
    <header class="page-header">
      <h2 class="header-title">数据库配置管理</h2>
      <NText depth="3" style="font-size: 13px">
        直接管理共享数据库中的配置表。修改将在下次 Agent 加载配置时生效。
      </NText>
    </header>

    <NCard style="margin-top: 16px">
      <NTabs v-model:value="activeTab" type="line" @update:value="handleTabChange">
        <NTabPane v-for="meta in tableMetas" :key="meta.key" :name="meta.key" :tab="meta.label">
          <div class="tab-toolbar">
            <NButton type="primary" size="small" @click="openCreate">
              <template #icon>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </template>
              添加{{ meta.label }}记录
            </NButton>
            <NButton size="small" @click="loadData" :loading="loading" style="margin-left: 8px">
              <template #icon>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </template>
              刷新
            </NButton>
          </div>

          <NSpin :show="loading" style="min-height: 200px">
            <div v-if="error" style="padding: 40px; text-align: center; color: var(--n-text-color-3)">
              {{ error }}
            </div>

            <NDataTable
              v-else
              :columns="[
                ...meta.columns.map(c => ({
                  title: c.title,
                  key: c.key,
                  width: c.width,
                  render: (row: DbRecord) => {
                    if (c.key === 'updated_at' || c.key === 'created_at') return formatTimestamp(row[c.key])
                    return h('span', formatValue(row[c.key], c.type))
                  }
                })),
                {
                  title: '操作',
                  key: 'actions',
                  width: 160,
                  render: (row: DbRecord) => h('div', { style: 'display:flex;gap:8px' }, [
                    h(NButton, { size: 'tiny', onClick: () => openEdit(row) }, { default: () => '编辑' }),
                    h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, {
                      trigger: () => h(NButton, { size: 'tiny', type: 'error', secondary: true }, { default: () => '删除' }),
                      default: () => '确定删除此记录？',
                    }),
                  ])
                }
              ]"
              :data="tableData[activeTab] || []"
              :bordered="false"
              :single-line="false"
              size="small"
              style="margin-top: 12px"
            />
          </NSpin>
        </NTabPane>
      </NTabs>
    </NCard>

    <!-- 编辑/创建弹窗 -->
    <NModal v-model:show="showModal" :title="editingRecord ? '编辑记录' : '创建记录'" style="max-width: 520px" preset="card">
      <NForm label-placement="left" label-width="100">
        <NFormItem
          v-for="field in tableMetas.find(m => m.key === editingTable)?.editableFields || []"
          :key="field.key"
          :label="field.label"
        >
          <NSwitch
            v-if="field.type === 'bool'"
            :value="formData[field.key]"
            @update:value="(v: boolean) => formData[field.key] = v"
          />
          <NInputNumber
            v-else-if="field.type === 'number'"
            v-model:value="formData[field.key]"
            style="width: 100%"
          />
          <NSelect
            v-else-if="field.type === 'select'"
            v-model:value="formData[field.key]"
            :options="field.options"
            style="width: 100%"
          />
          <NInput
            v-else
            v-model:value="formData[field.key]"
            style="width: 100%"
          />
        </NFormItem>
      </NForm>

      <template #footer>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <NButton @click="showModal = false">取消</NButton>
          <NButton type="primary" @click="handleSubmit" :loading="submitting">
            {{ editingRecord ? '保存' : '创建' }}
          </NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.config-db-view {
  padding: 16px 24px;
  max-width: 1200px;
}

.page-header {
  display: flex;
  align-items: baseline;
  gap: 16px;
  margin-bottom: 4px;
}

.header-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.tab-toolbar {
  display: flex;
  align-items: center;
  padding: 12px 0 4px;
}
</style>
