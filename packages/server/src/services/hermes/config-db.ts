import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { resolve as pathResolve } from 'path'
import { logger } from '../../services/logger'

const execOpts = { windowsHide: true }

function resolvePythonBin(): string {
  const envBin = process.env.PYTHON_BIN?.trim()
  if (envBin) return envBin
  return process.platform === 'win32' ? 'python' : 'python3'
}

function resolveConfigApiScript(): string {
  const envPath = process.env.HERMES_CONFIG_API?.trim()
  if (envPath && existsSync(envPath)) return envPath

  // Try common locations relative to the monorepo
  const candidates = [
    pathResolve(process.cwd(), '../../hermes-agent/tools/config_db_api.py'),
    pathResolve(process.cwd(), '../hermes-agent/tools/config_db_api.py'),
    pathResolve(process.cwd(), 'tools/config_db_api.py'),
    '/opt/hermes/hermes-agent/tools/config_db_api.py',
  ]

  if (process.env.HERMES_AGENT_DIR) {
    candidates.unshift(pathResolve(process.env.HERMES_AGENT_DIR, 'tools/config_db_api.py'))
  }

  for (const p of candidates) {
    if (existsSync(p)) return p
  }

  throw new Error(
    `config_db_api.py not found. Searched: ${candidates.join(', ')}. ` +
    `Set HERMES_CONFIG_API or HERMES_AGENT_DIR environment variable.`
  )
}

const PYTHON_BIN = resolvePythonBin()
const CONFIG_API_SCRIPT = resolveConfigApiScript()

export interface ConfigDbRequest {
  action: 'list' | 'create' | 'update' | 'delete'
  table: string
  profile?: string
  data?: Record<string, any>
  // 雪花算法 ID 超过 JS 安全整数，使用字符串
  id?: string | number
}

export interface ConfigDbResponse {
  success: boolean
  data?: any[]
  id?: string | number
  affected?: number
  error?: string
  traceback?: string
}

/**
 * Call the Python config_db_api.py with JSON request via stdin.
 * The child process inherits environment variables including HERMES_DB_TYPE and HERMES_DB_URL.
 */
export function callConfigApi(request: ConfigDbRequest): Promise<ConfigDbResponse> {
  return new Promise((resolve) => {
    const child = spawn(PYTHON_BIN, [CONFIG_API_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString('utf-8')
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf-8')
    })

    child.on('error', (err: Error) => {
      logger.error(err, 'Config DB API: spawn error')
      resolve({ success: false, error: `无法启动 Python 进程: ${err.message}` })
    })

    child.on('close', (code: number | null) => {
      if (stderr) {
        logger.warn('Config DB API: stderr output: %s', stderr)
      }

      if (code !== 0) {
        resolve({ success: false, error: `进程退出码 ${code}: ${stderr}` })
        return
      }

      try {
        const result: ConfigDbResponse = JSON.parse(stdout.trim())
        resolve(result)
      } catch {
        resolve({ success: false, error: `无效的 JSON 响应: ${stdout.slice(0, 500)}` })
      }
    })

    // 写入 JSON 请求到 stdin
    const requestJson = JSON.stringify({
      ...request,
      profile: request.profile || 'default',
    })
    child.stdin.write(requestJson)
    child.stdin.end()

    // 15 秒超时
    setTimeout(() => {
      child.kill()
      resolve({ success: false, error: '请求超时' })
    }, 15000)
  })
}
