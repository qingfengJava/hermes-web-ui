import { callConfigApi } from '../../services/hermes/config-db'

const VALID_TABLES = [
  'agent_settings', 'model_configs', 'provider_configs',
  'toolset_configs', 'skill_configs', 'platform_configs',
]

function validateTable(ctx: any, table: string): boolean {
  if (!VALID_TABLES.includes(table)) {
    ctx.status = 400
    ctx.body = { error: `未知配置表: ${table}` }
    return false
  }
  return true
}

/**
 * GET /api/hermes/config-db/:table
 * 列出指定配置表的所有记录
 */
export async function listConfig(ctx: any) {
  const table = ctx.params.table
  if (!validateTable(ctx, table)) return
  const profile = ctx.query.profile || 'default'

  const result = await callConfigApi({ action: 'list', table, profile })
  if (!result.success) {
    ctx.status = 500
    ctx.body = { error: result.error }
    return
  }
  ctx.body = { success: true, data: result.data }
}

/**
 * POST /api/hermes/config-db/:table
 * 创建一条配置记录
 */
export async function createConfig(ctx: any) {
  const table = ctx.params.table
  if (!validateTable(ctx, table)) return

  const { data, profile } = ctx.request.body || {}
  if (!data || Object.keys(data).length === 0) {
    ctx.status = 400
    ctx.body = { error: '缺少 data 参数' }
    return
  }

  const result = await callConfigApi({
    action: 'create', table,
    profile: profile || 'default',
    data,
  })

  if (!result.success) {
    ctx.status = 500
    ctx.body = { error: result.error }
    return
  }
  ctx.body = { success: true, id: result.id }
}

/**
 * PUT /api/hermes/config-db/:table/:id
 * 更新一条配置记录
 */
export async function updateConfig(ctx: any) {
  const { table, id } = ctx.params
  if (!validateTable(ctx, table)) return

  const { data } = ctx.request.body || {}
  if (!data || Object.keys(data).length === 0) {
    ctx.status = 400
    ctx.body = { error: '缺少 data 参数' }
    return
  }

  const result = await callConfigApi({
    action: 'update', table,
    // ID 保持为字符串（雪花算法 ID 超过 JS 安全整数范围）
    data: { ...data, id },
  })

  if (!result.success) {
    ctx.status = 500
    ctx.body = { error: result.error }
    return
  }
  ctx.body = { success: true, affected: result.affected }
}

/**
 * DELETE /api/hermes/config-db/:table/:id
 * 删除一条配置记录
 */
export async function deleteConfig(ctx: any) {
  const { table, id } = ctx.params
  if (!validateTable(ctx, table)) return

  // ID 保持为字符串（雪花算法 ID 超过 JS 安全整数范围）
  const result = await callConfigApi({ action: 'delete', table, id })
  if (!result.success) {
    ctx.status = 500
    ctx.body = { error: result.error }
    return
  }
  ctx.body = { success: true, affected: result.affected }
}
