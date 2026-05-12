/**
 * Providers 控制器 —— 使用共享数据库存储供应商配置。
 *
 * 作者: 清风
 */
import { existsSync, readFileSync } from 'fs'
import { writeFile } from 'fs/promises'
import { getActiveAuthPath } from '../../services/hermes/hermes-profile'
import * as hermesCli from '../../services/hermes/hermes-cli'
import { saveEnvValue, PROVIDER_ENV_MAP } from '../../services/config-helpers'
import { PROVIDER_PRESETS } from '../../shared/providers'
import { callConfigApi } from '../../services/hermes/config-db'
import { logger } from '../../services/logger'

const OPTIONAL_API_KEY_PROVIDERS = new Set(['cliproxyapi'])

/**
 * 通过 provider_key 查找 provider_configs 记录
 */
async function findProviderByKey(providerKey: string): Promise<any | null> {
  const result = await callConfigApi({
    action: 'list',
    table: 'provider_configs',
    profile: 'default',
  })
  if (!result.success || !result.data) return null
  return result.data.find((r: any) => r.provider_key === providerKey) || null
}

/**
 * 创建或更新 provider_configs 记录
 */
async function upsertProvider(providerKey: string, data: {
  display_name?: string
  base_url?: string
  api_mode?: string
  auth_type?: string
  env_var_name?: string
  enabled?: boolean
}): Promise<{ success: boolean; error?: string }> {
  const existing = await findProviderByKey(providerKey)

  if (existing) {
    const updateResult = await callConfigApi({
      action: 'update',
      table: 'provider_configs',
      data: { ...data, id: existing.id, enabled: data.enabled !== false },
    })
    return updateResult
  } else {
    const createResult = await callConfigApi({
      action: 'create',
      table: 'provider_configs',
      profile: 'default',
      data: {
        provider_key: providerKey,
        display_name: data.display_name || providerKey,
        base_url: data.base_url || '',
        api_mode: data.api_mode || 'chat_completions',
        auth_type: data.auth_type || 'api_key',
        env_var_name: data.env_var_name || '',
        enabled: data.enabled !== false,
      },
    })
    return createResult
  }
}

/**
 * 设置默认模型
 */
async function setDefaultModelInDb(modelName: string, providerKey: string): Promise<void> {
  // 查询当前 model_configs 中是否有该模型的记录
  const listResult = await callConfigApi({
    action: 'list',
    table: 'model_configs',
    profile: 'default',
  })

  if (listResult.success && listResult.data) {
    // 清除所有现有默认标记
    for (const row of listResult.data) {
      if (row.is_default) {
        await callConfigApi({
          action: 'update',
          table: 'model_configs',
          data: { id: row.id, is_default: false },
        })
      }
    }
  }

  // 查找该 provider+model 的记录
  const existing = listResult.data?.find(
    (r: any) => r.provider_key === providerKey && r.model_name === modelName
  )

  if (existing) {
    await callConfigApi({
      action: 'update',
      table: 'model_configs',
      data: { id: existing.id, is_default: true, enabled: true },
    })
  } else {
    await callConfigApi({
      action: 'create',
      table: 'model_configs',
      profile: 'default',
      data: {
        model_name: modelName,
        provider_key: providerKey,
        is_default: true,
        enabled: true,
      },
    })
  }
}

export async function create(ctx: any) {
  const { name, base_url, api_key, model, context_length, providerKey } = ctx.request.body as {
    name: string; base_url: string; api_key: string; model: string; context_length?: number; providerKey?: string | null
  }
  if (!name || !base_url || !model) {
    ctx.status = 400; ctx.body = { error: 'Missing name, base_url, or model' }; return
  }
  if (!api_key && !OPTIONAL_API_KEY_PROVIDERS.has(String(providerKey || ''))) {
    ctx.status = 400; ctx.body = { error: 'Missing API key' }; return
  }
  try {
    const poolKey = providerKey || `custom:${name.trim().toLowerCase().replace(/ /g, '-')}`
    const isBuiltin = poolKey in PROVIDER_ENV_MAP

    if (isBuiltin) {
      // 内置供应商：保存 API key 到环境变量文件
      if (PROVIDER_ENV_MAP[poolKey].api_key_env) {
        await saveEnvValue(PROVIDER_ENV_MAP[poolKey].api_key_env, api_key)
        if (PROVIDER_ENV_MAP[poolKey].base_url_env) {
          await saveEnvValue(PROVIDER_ENV_MAP[poolKey].base_url_env, base_url)
        }
      }
    } else {
      // 自定义供应商：保存 API key 到环境变量文件
      const envVarName = `CUSTOM_${name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`
      await saveEnvValue(envVarName, api_key)
    }

    // 写入 provider_configs 表
    const preset = PROVIDER_PRESETS.find((p: any) => p.value === poolKey.replace('custom:', ''))
    const displayName = preset?.label || name
    const envVarName = isBuiltin
      ? (PROVIDER_ENV_MAP[poolKey]?.api_key_env || '')
      : `CUSTOM_${name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')}_API_KEY`
    const authType = preset?.auth_type || 'api_key'
    const apiMode = preset?.api_mode || 'chat_completions'

    const upsertResult = await upsertProvider(
      isBuiltin ? poolKey : `custom:${name.trim().toLowerCase().replace(/ /g, '-')}`,
      {
        display_name: displayName,
        base_url: preset?.base_url || base_url,
        api_mode: apiMode,
        auth_type: authType,
        env_var_name: envVarName,
        enabled: true,
      },
    )

    if (!upsertResult.success) {
      ctx.status = 500; ctx.body = { error: upsertResult.error || '保存供应商配置失败' }; return
    }

    // 设置默认模型
    await setDefaultModelInDb(model, isBuiltin ? poolKey : `custom:${name.trim().toLowerCase().replace(/ /g, '-')}`)

    try { await hermesCli.restartGateway() } catch (e: any) { logger.error(e, 'Gateway restart failed') }
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500; ctx.body = { error: err.message }
  }
}

export async function update(ctx: any) {
  const poolKey = decodeURIComponent(ctx.params.poolKey)
  const { name, base_url, api_key, model } = ctx.request.body as {
    name?: string; base_url?: string; api_key?: string; model?: string
  }
  try {
    const isBuiltin = !poolKey.startsWith('custom:')

    if (isBuiltin) {
      // 内置供应商：更新 API key 到环境变量文件
      const envMapping = PROVIDER_ENV_MAP[poolKey]
      if (envMapping?.api_key_env && api_key !== undefined) {
        await saveEnvValue(envMapping.api_key_env, api_key)
      } else if (!envMapping?.api_key_env) {
        // OAuth 供应商：没有 API key 需要更新
      } else {
        ctx.status = 400; ctx.body = { error: `Cannot update credentials for "${poolKey}"` }; return
      }
    }

    // 更新 provider_configs 表
    const existing = await findProviderByKey(poolKey)
    if (!existing) {
      ctx.status = 404; ctx.body = { error: `Provider "${poolKey}" not found` }; return
    }

    const updateData: any = { id: existing.id }
    if (name !== undefined) updateData.display_name = name
    if (base_url !== undefined) updateData.base_url = base_url

    const updateResult = await callConfigApi({
      action: 'update',
      table: 'provider_configs',
      data: updateData,
    })

    if (!updateResult.success) {
      ctx.status = 500; ctx.body = { error: updateResult.error || '更新供应商配置失败' }; return
    }

    // 如果指定了 model，更新默认模型
    if (model !== undefined) {
      await setDefaultModelInDb(model, poolKey)
    }

    try { await hermesCli.restartGateway() } catch (e: any) { logger.error(e, 'Gateway restart failed') }
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500; ctx.body = { error: err.message }
  }
}

export async function remove(ctx: any) {
  const poolKey = decodeURIComponent(ctx.params.poolKey)
  try {
    const isBuiltin = !poolKey.startsWith('custom:')

    if (isBuiltin) {
      // 内置供应商：清除环境变量文件中的 API key
      const envMapping = PROVIDER_ENV_MAP[poolKey]
      if (envMapping?.api_key_env) {
        await saveEnvValue(envMapping.api_key_env, '')
        if (envMapping.base_url_env) { await saveEnvValue(envMapping.base_url_env, '') }
      } else if (!envMapping?.api_key_env) {
        // OAuth 供应商：清除 auth.json 中的 tokens
        try {
          const authPath = getActiveAuthPath()
          if (existsSync(authPath)) {
            const auth = JSON.parse(readFileSync(authPath, 'utf-8'))
            if (auth.providers?.[poolKey]) { delete auth.providers[poolKey] }
            if (auth.credential_pool?.[poolKey]) { delete auth.credential_pool[poolKey] }
            await writeFile(authPath, JSON.stringify(auth, null, 2) + '\n', 'utf-8')
          }
        } catch (err: any) { logger.error(err, 'Failed to clear OAuth tokens for %s', poolKey) }
      }
    }

    // 从 provider_configs 表中删除
    const existing = await findProviderByKey(poolKey)
    if (existing) {
      await callConfigApi({
        action: 'delete',
        table: 'provider_configs',
        id: existing.id,
      })
    }

    // 清除 model_configs 中该 provider 的默认标记
    const listResult = await callConfigApi({
      action: 'list',
      table: 'model_configs',
      profile: 'default',
    })
    if (listResult.success && listResult.data) {
      const modelRows = listResult.data.filter((r: any) => r.provider_key === poolKey)
      for (const row of modelRows) {
        await callConfigApi({
          action: 'delete',
          table: 'model_configs',
          id: row.id,
        })
      }
    }

    // 切换到剩余的第一个 provider
    const remainingResult = await callConfigApi({
      action: 'list',
      table: 'provider_configs',
      profile: 'default',
    })
    if (remainingResult.success && remainingResult.data && remainingResult.data.length > 0) {
      const nextProvider = remainingResult.data[0]
      // 查找该 provider 的模型
      const modelsResult = await callConfigApi({
        action: 'list',
        table: 'model_configs',
        profile: 'default',
      })
      const providerModel = modelsResult.data?.find(
        (r: any) => r.provider_key === nextProvider.provider_key
      )
      if (providerModel) {
        await setDefaultModelInDb(providerModel.model_name, nextProvider.provider_key)
      }
    }

    try { await hermesCli.restartGateway() } catch (e: any) { logger.error(e, 'Gateway restart failed') }
    ctx.body = { success: true }
  } catch (err: any) {
    ctx.status = 500; ctx.body = { error: err.message }
  }
}
