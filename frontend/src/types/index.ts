export type ProductStatus = '待寄回' | '已寄回' | '已到货' | '已发出' | '已完成'

export type AppView =
  | 'specs'
  | 'products'
  | 'ali-orders'
  | 'qianniu-orders'
  | 'loss-records'
  | 'gross-profit'
  | 'express-query'
  | 'users'

export interface UserAccount {
  id: number
  username: string
  email: string
  avatarDataUrl: string
  note: string
  createdAt?: string
  updatedAt?: string
}

export interface AuthResponse {
  token: string
  user: UserAccount
}

export interface UserPayload {
  username: string
  email: string
  password: string
  avatarDataUrl: string
  note?: string
}

export interface Specification {
  id: number
  name: string
  sortOrder: number
}

export interface Category {
  id: number
  name: string
  sortOrder: number
  specs: Specification[]
  createdAt?: string
}

export interface ProductRecord {
  id: number
  categoryId: number
  parentProductId: number | null
  sortOrder: number
  price: number
  quantity: number
  status: ProductStatus
  note: string
  createdAt?: string
  updatedAt?: string
  specValues: Record<number, string>
}

export interface CategoryPayload {
  name: string
  specs: string[]
}

export interface ProductPayload {
  categoryId: number
  parentProductId?: number | null
  price: number
  quantity: number
  status: ProductStatus
  note: string
  specValues: Record<number, string>
}

export interface LossRecord {
  id: number
  reason: string
  lossAmount: number
  shippingLoss: number
  otherLoss: number
  note: string
  lossDate: string
  createdAt?: string
  updatedAt?: string
}

export interface LossRecordPayload {
  reason: string
  lossAmount: number
  shippingLoss: number
  otherLoss: number
  note: string
  lossDate: string
}

export interface GrossProfitRecord {
  id: number
  actualRevenue: number
  actualCost: number
  actualGrossProfit: number
  grossProfitRate: number
  recordDate: string
  note: string
  createdAt?: string
  updatedAt?: string
}

export interface GrossProfitRecordPayload {
  actualRevenue: number
  actualCost: number
  recordDate: string
  note: string
}

export interface ExpressTraceItem {
  time: string
  status: string
}

export interface ExpressQueryResult {
  number: string
  type: string
  typename: string
  logo: string
  list: ExpressTraceItem[]
  deliverystatus: number
  issign: number
}

export interface ExpressQueryResponse {
  status: number
  msg: string
  result: ExpressQueryResult
}
