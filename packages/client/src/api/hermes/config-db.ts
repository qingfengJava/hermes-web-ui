import { request } from '../client'

export interface DbRecord {
  id: number
  [key: string]: any
}

export interface ListResponse {
  success: boolean
  data: DbRecord[]
}

export interface MutateResponse {
  success: boolean
  id?: number
  affected?: number
}

/**
 * 列出指定配置表的所有记录
 */
export function listConfigDb(table: string, profile?: string): Promise<ListResponse> {
  const query = profile ? `?profile=${encodeURIComponent(profile)}` : ''
  return request<ListResponse>(`/api/hermes/config-db/${table}${query}`)
}

/**
 * 创建一条配置记录
 */
export function createConfigDb(table: string, data: Record<string, any>, profile?: string): Promise<MutateResponse> {
  return request<MutateResponse>(`/api/hermes/config-db/${table}`, {
    method: 'POST',
    body: JSON.stringify({ data, profile }),
  })
}

/**
 * 更新一条配置记录
 */
export function updateConfigDb(table: string, id: number, data: Record<string, any>): Promise<MutateResponse> {
  return request<MutateResponse>(`/api/hermes/config-db/${table}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ data }),
  })
}

/**
 * 删除一条配置记录
 */
export function deleteConfigDb(table: string, id: number): Promise<MutateResponse> {
  return request<MutateResponse>(`/api/hermes/config-db/${table}/${id}`, {
    method: 'DELETE',
  })
}
