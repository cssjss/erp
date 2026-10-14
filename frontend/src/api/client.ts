import axios from 'axios'
import type {
  AuthResponse,
  Category,
  CategoryPayload,
  ExpressQueryResponse,
  GrossProfitRecord,
  GrossProfitRecordPayload,
  LossRecord,
  LossRecordPayload,
  ProductPayload,
  ProductRecord,
  ProductStatus,
  UserAccount,
  UserPayload,
} from '../types'

const AUTH_TOKEN_KEY = 'simple_erp_auth_token'
let unauthorizedHandler: (() => void) | null = null

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

api.interceptors.request.use((config) => {
  const token = getStoredToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      clearStoredToken()
      unauthorizedHandler?.()
    }

    return Promise.reject(error)
  },
)

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

export function getStoredToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY)
}

export function storeAuthToken(token: string) {
  window.localStorage.setItem(AUTH_TOKEN_KEY, token)
}

export function clearStoredToken() {
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

export async function login(payload: { account: string; password: string }) {
  const response = await api.post<AuthResponse>('/auth/login', payload)
  return response.data
}

export async function register(payload: UserPayload) {
  const response = await api.post<AuthResponse>('/auth/register', payload)
  return response.data
}

export async function fetchCurrentUser() {
  const response = await api.get<UserAccount>('/auth/me')
  return response.data
}

export async function fetchCategories() {
  const response = await api.get<Category[]>('/categories')
  return response.data
}

export async function createCategory(payload: CategoryPayload) {
  const response = await api.post<Category>('/categories', payload)
  return response.data
}

export async function reorderCategories(categoryIds: number[]) {
  const response = await api.put<{ categoryIds: number[] }>('/categories/reorder', { categoryIds })
  return response.data
}

export async function deleteCategory(categoryId: number) {
  const response = await api.delete<{ id: number; deleted: boolean }>(`/categories/${categoryId}`)
  return response.data
}

export async function fetchProducts(categoryId: number) {
  const response = await api.get<ProductRecord[]>('/products', {
    params: { categoryId },
  })
  return response.data
}

export async function createProduct(payload: ProductPayload) {
  const response = await api.post<ProductRecord>('/products', payload)
  return response.data
}

export async function updateProduct(productId: number, payload: ProductPayload) {
  const response = await api.put<ProductRecord>(`/products/${productId}`, payload)
  return response.data
}

export async function updateProductStatus(productId: number, status: ProductStatus) {
  const response = await api.patch<{ id: number; status: ProductStatus }>(
    `/products/${productId}/status`,
    { status },
  )
  return response.data
}

export async function deleteProduct(productId: number) {
  const response = await api.delete<{ id: number; deleted: boolean }>(`/products/${productId}`)
  return response.data
}

export async function moveProduct(productId: number, direction: 'up' | 'down') {
  const response = await api.patch<{ moved: boolean }>(`/products/${productId}/move`, { direction })
  return response.data
}

export async function batchUpdateProductStatus(productIds: number[], status: ProductStatus) {
  const response = await api.patch<{ updated: number; productIds: number[]; status: ProductStatus }>(
    '/products/batch/status',
    { productIds, status },
  )
  return response.data
}

export async function batchDeleteProducts(productIds: number[]) {
  const response = await api.post<{ deleted: number; productIds: number[] }>(
    '/products/batch-delete',
    { productIds },
  )
  return response.data
}

export async function fetchUsers() {
  const response = await api.get<UserAccount[]>('/users')
  return response.data
}

export async function createUser(payload: UserPayload) {
  const response = await api.post<UserAccount>('/users', payload)
  return response.data
}

export async function resetUserPassword(userId: number, password: string) {
  const response = await api.patch<{ id: number; passwordReset: boolean }>(
    `/users/${userId}/password`,
    { password },
  )
  return response.data
}

export async function updateUserNote(userId: number, note: string) {
  const response = await api.patch<{ id: number; note: string }>(`/users/${userId}/note`, { note })
  return response.data
}

export async function deleteUser(userId: number) {
  const response = await api.delete<{ id: number; deleted: boolean }>(`/users/${userId}`)
  return response.data
}

export async function fetchLossRecords(params?: {
  dateFrom?: string
  dateTo?: string
  keyword?: string
}) {
  const response = await api.get<LossRecord[]>('/loss-records', { params })
  return response.data
}

export async function createLossRecord(payload: LossRecordPayload) {
  const response = await api.post<LossRecord>('/loss-records', payload)
  return response.data
}

export async function updateLossRecord(recordId: number, payload: LossRecordPayload) {
  const response = await api.put<LossRecord>(`/loss-records/${recordId}`, payload)
  return response.data
}

export async function deleteLossRecord(recordId: number) {
  const response = await api.delete<{ id: number; deleted: boolean }>(`/loss-records/${recordId}`)
  return response.data
}

export async function batchDeleteLossRecords(recordIds: number[]) {
  const response = await api.post<{ deleted: number; recordIds: number[] }>(
    '/loss-records/batch-delete',
    { recordIds },
  )
  return response.data
}

export async function fetchGrossProfitRecords() {
  const response = await api.get<GrossProfitRecord[]>('/gross-profit-records')
  return response.data
}

export async function createGrossProfitRecord(payload: GrossProfitRecordPayload) {
  const response = await api.post<GrossProfitRecord>('/gross-profit-records', payload)
  return response.data
}

export async function updateGrossProfitRecord(recordId: number, payload: GrossProfitRecordPayload) {
  const response = await api.put<GrossProfitRecord>(`/gross-profit-records/${recordId}`, payload)
  return response.data
}

export async function deleteGrossProfitRecord(recordId: number) {
  const response = await api.delete<{ id: number; deleted: boolean }>(`/gross-profit-records/${recordId}`)
  return response.data
}

export async function batchDeleteGrossProfitRecords(recordIds: number[]) {
  const response = await api.post<{ deleted: number; recordIds: number[] }>(
    '/gross-profit-records/batch-delete',
    { recordIds },
  )
  return response.data
}

export async function queryExpress(params: {
  appkey: string
  number: string
  mobile?: string
}) {
  const response = await api.get<ExpressQueryResponse>('/express/query', {
    params,
  })
  return response.data
}
