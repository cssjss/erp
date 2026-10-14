import { useEffect, useState } from 'react'
import './App.css'
import {
  clearStoredToken,
  batchDeleteProducts,
  batchDeleteGrossProfitRecords,
  batchUpdateProductStatus,
  batchDeleteLossRecords,
  createGrossProfitRecord,
  createCategory,
  createLossRecord,
  createProduct,
  createUser,
  deleteCategory,
  deleteGrossProfitRecord,
  deleteLossRecord,
  deleteProduct,
  deleteUser,
  fetchCurrentUser,
  fetchCategories,
  fetchGrossProfitRecords,
  fetchLossRecords,
  fetchProducts,
  fetchUsers,
  getStoredToken,
  login,
  moveProduct,
  register,
  reorderCategories,
  resetUserPassword,
  setUnauthorizedHandler,
  storeAuthToken,
  updateGrossProfitRecord,
  updateLossRecord,
  updateProduct,
  updateProductStatus,
  updateUserNote,
} from './api/client'
import { AuthScreen } from './components/AuthScreen'
import { CategorySidebar } from './components/CategorySidebar'
import { AliOrderAnalyzer } from './components/AliOrderAnalyzer'
import { ExpressTracker } from './components/ExpressTracker'
import { GrossProfitManager } from './components/GrossProfitManager'
import { LossRecordManager } from './components/LossRecordManager'
import { ProductManager } from './components/ProductManager'
import { QianniuOrderAnalyzer } from './components/QianniuOrderAnalyzer'
import { SpecBuilder } from './components/SpecBuilder'
import { UserManager } from './components/UserManager'
import type {
  AppView,
  Category,
  GrossProfitRecord,
  GrossProfitRecordPayload,
  LossRecord,
  LossRecordPayload,
  ProductRecord,
  ProductStatus,
  UserAccount,
  UserPayload,
} from './types'

const SIDEBAR_MIN_WIDTH = 220
const SIDEBAR_MAX_WIDTH = 320
const SIDEBAR_DEFAULT_WIDTH = 248
const SIDEBAR_COLLAPSED_WIDTH = 0

function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null)
  const [authChecking, setAuthChecking] = useState(true)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [selectedView, setSelectedView] = useState<AppView>('specs')
  const [products, setProducts] = useState<ProductRecord[]>([])
  const [lossRecords, setLossRecords] = useState<LossRecord[]>([])
  const [grossProfitRecords, setGrossProfitRecords] = useState<GrossProfitRecord[]>([])
  const [users, setUsers] = useState<UserAccount[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lossFilters, setLossFilters] = useState({
    dateFrom: '',
    dateTo: '',
    keyword: '',
  })
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const selectedCategory =
    categories.find((category) => category.id === selectedCategoryId) || null

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearStoredToken()
      setCurrentUser(null)
      setCategories([])
      setProducts([])
      setLossRecords([])
      setGrossProfitRecords([])
      setUsers([])
      setSelectedView('specs')
      setError('登录状态已失效，请重新登录。')
    })

    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    void initializeAuth()
  }, [])

  useEffect(() => {
    if (currentUser) {
      void loadCategories()
    }
  }, [currentUser])

  useEffect(() => {
    if (currentUser && selectedCategoryId) {
      void loadProducts(selectedCategoryId)
    } else {
      setProducts([])
    }
  }, [currentUser, selectedCategoryId])

  useEffect(() => {
    if (!currentUser) {
      return
    }

    if (selectedView === 'loss-records') {
      void loadLossRecords(lossFilters)
    } else if (selectedView === 'gross-profit') {
      void loadGrossProfitRecords()
    } else if (selectedView === 'users') {
      void loadUsers()
    }
  }, [currentUser, selectedView, lossFilters])

  async function initializeAuth() {
    const token = getStoredToken()

    if (!token) {
      setAuthChecking(false)
      return
    }

    try {
      setAuthError('')
      const user = await fetchCurrentUser()
      setCurrentUser(user)
    } catch {
      clearStoredToken()
      setCurrentUser(null)
      setAuthError('登录状态已失效，请重新登录。')
    } finally {
      setAuthChecking(false)
    }
  }

  async function handleLogin(payload: { account: string; password: string }) {
    try {
      setAuthBusy(true)
      setAuthError('')
      setError('')
      const data = await login(payload)
      storeAuthToken(data.token)
      setCurrentUser(data.user)
      setSelectedView('specs')
    } catch (err: any) {
      setAuthError(err?.response?.data?.message || '登录失败。')
    } finally {
      setAuthBusy(false)
    }
  }

  async function handleRegister(payload: UserPayload) {
    try {
      setAuthBusy(true)
      setAuthError('')
      setError('')
      const data = await register(payload)
      storeAuthToken(data.token)
      setCurrentUser(data.user)
      setSelectedView('specs')
    } catch (err: any) {
      setAuthError(err?.response?.data?.message || '注册失败。')
    } finally {
      setAuthBusy(false)
    }
  }

  function handleLogout() {
    clearStoredToken()
    setCurrentUser(null)
    setCategories([])
    setSelectedCategoryId(null)
    setProducts([])
    setLossRecords([])
    setGrossProfitRecords([])
    setUsers([])
    setSelectedView('specs')
    setError('')
    setAuthError('')
  }

  async function loadCategories() {
    try {
      setError('')
      const data = await fetchCategories()
      setCategories(data)
      setSelectedCategoryId((current) => current ?? data[0]?.id ?? null)
    } catch {
      setError('分类数据加载失败，请确认后端服务和数据库已启动。')
    }
  }

  async function loadUsers() {
    try {
      setError('')
      const data = await fetchUsers()
      setUsers(data)
    } catch {
      setError('用户数据加载失败，请确认接口连接正常。')
    }
  }

  async function loadProducts(categoryId: number) {
    try {
      setError('')
      const data = await fetchProducts(categoryId)
      setProducts(data)
    } catch {
      setError('产品数据加载失败，请确认接口连接正常。')
    }
  }

  async function loadLossRecords(filters = lossFilters) {
    try {
      setError('')
      const data = await fetchLossRecords(filters)
      setLossRecords(data)
    } catch {
      setError('亏损记录加载失败，请确认接口连接正常。')
    }
  }

  async function loadGrossProfitRecords() {
    try {
      setError('')
      const data = await fetchGrossProfitRecords()
      setGrossProfitRecords(data)
    } catch {
      setError('毛利记录加载失败，请确认接口连接正常。')
    }
  }

  async function handleCreateCategory(payload: { name: string; specs: string[] }) {
    try {
      setBusy(true)
      setError('')
      await createCategory(payload)
      await loadCategories()
      setSelectedView('specs')
    } catch (err: any) {
      setError(err?.response?.data?.message || '保存分类失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteCategory(categoryId: number) {
    try {
      setBusy(true)
      setError('')
      await deleteCategory(categoryId)
      setCategories((current) => current.filter((category) => category.id !== categoryId))

      if (selectedCategoryId === categoryId) {
        setSelectedCategoryId(null)
        setProducts([])
      }

      await loadCategories()
    } catch (err: any) {
      setError(err?.response?.data?.message || '删除分类失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleReorderCategories(categoryIds: number[]) {
    const categoryMap = new Map(categories.map((category) => [category.id, category]))
    const reorderedCategories = categoryIds
      .map((id, index) => {
        const category = categoryMap.get(id)
        return category ? { ...category, sortOrder: index + 1 } : null
      })
      .filter((category): category is Category => category !== null)

    if (reorderedCategories.length !== categories.length) {
      return
    }

    setCategories(reorderedCategories)

    try {
      setError('')
      await reorderCategories(categoryIds)
    } catch (err: any) {
      setError(err?.response?.data?.message || '分类排序保存失败，请重试。')
      await loadCategories()
    }
  }

  async function handleCreateProduct(payload: {
    categoryId: number
    parentProductId?: number | null
    price: number
    quantity: number
    status: ProductStatus
    note: string
    specValues: Record<number, string>
  }) {
    try {
      setBusy(true)
      setError('')
      await createProduct(payload)
      await loadProducts(payload.categoryId)
      setSelectedView('products')
    } catch (err: any) {
      setError(err?.response?.data?.message || '新增产品失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateProduct(
    productId: number,
    payload: {
      categoryId: number
      parentProductId?: number | null
      price: number
      quantity: number
      status: ProductStatus
      note: string
      specValues: Record<number, string>
    },
  ) {
    try {
      setBusy(true)
      setError('')
      await updateProduct(productId, payload)
      await loadProducts(payload.categoryId)
    } catch (err: any) {
      setError(err?.response?.data?.message || '更新产品失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateStatus(productId: number, status: ProductStatus) {
    if (!selectedCategoryId) {
      return
    }

    try {
      setError('')
      await updateProductStatus(productId, status)
      await loadProducts(selectedCategoryId)
    } catch (err: any) {
      setError(err?.response?.data?.message || '更新状态失败。')
    }
  }

  async function handleDeleteProduct(productId: number) {
    if (!selectedCategoryId) {
      return
    }

    try {
      setBusy(true)
      setError('')
      await deleteProduct(productId)
      setProducts((current) => current.filter((product) => product.id !== productId))
      await loadProducts(selectedCategoryId)
    } catch (err: any) {
      setError(err?.response?.data?.message || '删除产品失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleMoveProduct(productId: number, direction: 'up' | 'down') {
    if (!selectedCategoryId) {
      return
    }

    try {
      setBusy(true)
      setError('')
      await moveProduct(productId, direction)
      await loadProducts(selectedCategoryId)
    } catch (err: any) {
      setError(err?.response?.data?.message || '调整产品顺序失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleBatchUpdateProductStatus(productIds: number[], status: ProductStatus) {
    if (!selectedCategoryId) {
      return
    }

    try {
      setBusy(true)
      setError('')
      await batchUpdateProductStatus(productIds, status)
      await loadProducts(selectedCategoryId)
    } catch (err: any) {
      setError(err?.response?.data?.message || '批量更新状态失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleBatchDeleteProducts(productIds: number[]) {
    if (!selectedCategoryId) {
      return
    }

    try {
      setBusy(true)
      setError('')
      await batchDeleteProducts(productIds)
      await loadProducts(selectedCategoryId)
    } catch (err: any) {
      setError(err?.response?.data?.message || '批量删除产品失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateLossRecord(payload: LossRecordPayload) {
    try {
      setBusy(true)
      setError('')
      await createLossRecord(payload)
      await loadLossRecords()
      setSelectedView('loss-records')
    } catch (err: any) {
      setError(err?.response?.data?.message || '新增亏损记录失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateLossRecord(recordId: number, payload: LossRecordPayload) {
    try {
      setBusy(true)
      setError('')
      await updateLossRecord(recordId, payload)
      await loadLossRecords()
    } catch (err: any) {
      setError(err?.response?.data?.message || '更新亏损记录失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteLossRecord(recordId: number) {
    try {
      setBusy(true)
      setError('')
      await deleteLossRecord(recordId)
      await loadLossRecords()
    } catch (err: any) {
      setError(err?.response?.data?.message || '删除亏损记录失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleBatchDeleteLossRecords(recordIds: number[]) {
    try {
      setBusy(true)
      setError('')
      await batchDeleteLossRecords(recordIds)
      await loadLossRecords()
    } catch (err: any) {
      setError(err?.response?.data?.message || '批量删除亏损记录失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateGrossProfitRecord(payload: GrossProfitRecordPayload) {
    try {
      setBusy(true)
      setError('')
      await createGrossProfitRecord(payload)
      await loadGrossProfitRecords()
      setSelectedView('gross-profit')
    } catch (err: any) {
      setError(err?.response?.data?.message || '新增毛利记录失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateGrossProfitRecord(recordId: number, payload: GrossProfitRecordPayload) {
    try {
      setBusy(true)
      setError('')
      await updateGrossProfitRecord(recordId, payload)
      await loadGrossProfitRecords()
    } catch (err: any) {
      setError(err?.response?.data?.message || '更新毛利记录失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteGrossProfitRecord(recordId: number) {
    try {
      setBusy(true)
      setError('')
      await deleteGrossProfitRecord(recordId)
      await loadGrossProfitRecords()
    } catch (err: any) {
      setError(err?.response?.data?.message || '删除毛利记录失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleBatchDeleteGrossProfitRecords(recordIds: number[]) {
    try {
      setBusy(true)
      setError('')
      await batchDeleteGrossProfitRecords(recordIds)
      await loadGrossProfitRecords()
    } catch (err: any) {
      setError(err?.response?.data?.message || '批量删除毛利记录失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateUser(payload: UserPayload) {
    try {
      setBusy(true)
      setError('')
      await createUser(payload)
      await loadUsers()
    } catch (err: any) {
      setError(err?.response?.data?.message || '新增用户失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleResetUserPassword(userId: number, password: string) {
    try {
      setBusy(true)
      setError('')
      await resetUserPassword(userId, password)
      await loadUsers()
    } catch (err: any) {
      setError(err?.response?.data?.message || '重置密码失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpdateUserNote(userId: number, note: string) {
    try {
      setBusy(true)
      setError('')
      await updateUserNote(userId, note)
      await loadUsers()
    } catch (err: any) {
      setError(err?.response?.data?.message || '更新用户备注失败。')
    } finally {
      setBusy(false)
    }
  }

  async function handleDeleteUser(userId: number) {
    try {
      setBusy(true)
      setError('')
      await deleteUser(userId)

      if (currentUser?.id === userId) {
        handleLogout()
        return
      }

      await loadUsers()
    } catch (err: any) {
      setError(err?.response?.data?.message || '删除用户失败。')
    } finally {
      setBusy(false)
    }
  }

  function handleSidebarResizeStart(event: React.PointerEvent<HTMLButtonElement>) {
    if (window.innerWidth <= 1100 || sidebarCollapsed) {
      return
    }

    event.preventDefault()
    const pointerId = event.pointerId

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = Math.min(
        SIDEBAR_MAX_WIDTH,
        Math.max(SIDEBAR_MIN_WIDTH, moveEvent.clientX),
      )
      setSidebarWidth(nextWidth)
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }

    event.currentTarget.setPointerCapture(pointerId)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
  }

  function handleToggleSidebarCollapse() {
    setSidebarCollapsed((current) => !current)
  }

  function handleToggleMobileSidebar() {
    setMobileSidebarOpen((current) => !current)
  }

  function handleSelectCategory(categoryId: number) {
    setSelectedCategoryId(categoryId)
    setSelectedView('products')
    setMobileSidebarOpen(false)
  }

  function handleSelectView(view: AppView) {
    setSelectedView(view)
    setMobileSidebarOpen(false)
  }

  if (authChecking) {
    return (
      <div className="auth-page">
        <section className="auth-panel">
          <div className="auth-loading">正在检查登录状态...</div>
        </section>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <AuthScreen
        loading={authBusy}
        error={authError || error}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    )
  }

  return (
    <div className="erp-layout">
      <header className="topbar">
        <div className="topbar__brand">
          <button
            type="button"
            className="topbar__menu-button"
            onClick={handleToggleMobileSidebar}
            aria-label={mobileSidebarOpen ? '关闭导航菜单' : '打开导航菜单'}
          >
            {mobileSidebarOpen ? '×' : '≡'}
          </button>
          <div className="topbar__logo">ERP</div>
          <div className="topbar__title">
            <strong>退货售后ERP系统</strong>
            <span>规格录入与产品录入</span>
          </div>
        </div>

        <div className="topbar__actions">
          <div className="topbar__user-profile">
            <div className="topbar__avatar">
              {currentUser.avatarDataUrl ? (
                <img src={currentUser.avatarDataUrl} alt={currentUser.username} />
              ) : (
                currentUser.username.slice(0, 1)
              )}
            </div>
            <span className="topbar__user">{currentUser.username}</span>
          </div>
          <button type="button" className="topbar__link" onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </header>

      <div
        className="app-shell"
        style={
          {
            '--sidebar-width': `${sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : sidebarWidth}px`,
          } as React.CSSProperties
        }
      >
        <CategorySidebar
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          selectedView={selectedView}
          collapsed={sidebarCollapsed}
          mobileOpen={mobileSidebarOpen}
          onSelectCategory={handleSelectCategory}
          onSelectView={handleSelectView}
          onReorderCategories={handleReorderCategories}
          onResizeStart={handleSidebarResizeStart}
          onToggleCollapse={handleToggleSidebarCollapse}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        {mobileSidebarOpen ? <button className="mobile-sidebar-backdrop" type="button" onClick={() => setMobileSidebarOpen(false)} /> : null}

        <main className="main-panel">
          <section className="workspace-tabs">
            <button type="button" className="workspace-tab">
              {selectedView === 'specs'
                ? '规格录入总览'
                : selectedView === 'products'
                  ? '产品录入总览'
                  : selectedView === 'ali-orders'
                    ? '阿里订单识别'
                  : selectedView === 'qianniu-orders'
                    ? '千牛订单识别'
                    : selectedView === 'loss-records'
                      ? '亏损记录'
                      : selectedView === 'gross-profit'
                        ? '毛利计算'
                        : selectedView === 'users'
                          ? '用户管理'
                          : '物流单号识别'}
            </button>
          </section>

          {/* <section className="toolbar-card">
            <div className="toolbar-card__main">
              <div className="toolbar-card__title">
                <strong>{selectedView === 'specs' ? '分类规格管理' : '产品资料录入'}</strong>
                <span>
                  {selectedCategory
                    ? `当前分类：${selectedCategory.name}`
                    : '请先在左侧导航中选择或创建一级分类'}
                </span>
              </div>
              <div className="toolbar-card__stats">
                <span>{categories.length} 个一级分类</span>
                <span>{selectedCategory ? `${selectedCategory.specs.length} 个子规格` : '0 个子规格'}</span>
              </div>
            </div>
          </section> */}

          {error ? <div className="error-banner">{error}</div> : null}

          {selectedView === 'specs' ? (
            <SpecBuilder
              selectedCategory={selectedCategory}
              onCreateCategory={handleCreateCategory}
              onDeleteCategory={handleDeleteCategory}
              loading={busy}
            />
          ) : selectedView === 'ali-orders' ? (
            <AliOrderAnalyzer />
          ) : selectedView === 'qianniu-orders' ? (
            <QianniuOrderAnalyzer />
          ) : selectedView === 'loss-records' ? (
            <LossRecordManager
              records={lossRecords}
              loading={busy}
              filterDateFrom={lossFilters.dateFrom}
              filterDateTo={lossFilters.dateTo}
              filterKeyword={lossFilters.keyword}
              onFilterChange={setLossFilters}
              onCreateRecord={handleCreateLossRecord}
              onUpdateRecord={handleUpdateLossRecord}
              onDeleteRecord={handleDeleteLossRecord}
              onBatchDeleteRecords={handleBatchDeleteLossRecords}
            />
          ) : selectedView === 'gross-profit' ? (
            <GrossProfitManager
              records={grossProfitRecords}
              loading={busy}
              onCreateRecord={handleCreateGrossProfitRecord}
              onUpdateRecord={handleUpdateGrossProfitRecord}
              onDeleteRecord={handleDeleteGrossProfitRecord}
              onBatchDeleteRecords={handleBatchDeleteGrossProfitRecords}
            />
          ) : selectedView === 'express-query' ? (
            <ExpressTracker />
          ) : selectedView === 'users' ? (
            <UserManager
              users={users}
              currentUser={currentUser}
              loading={busy}
              onCreateUser={handleCreateUser}
              onResetPassword={handleResetUserPassword}
              onUpdateNote={handleUpdateUserNote}
              onDeleteUser={handleDeleteUser}
            />
          ) : (
            <ProductManager
              selectedCategory={selectedCategory}
              products={products}
              loading={busy}
              onCreateProduct={handleCreateProduct}
              onUpdateProduct={handleUpdateProduct}
              onUpdateStatus={handleUpdateStatus}
              onDeleteProduct={handleDeleteProduct}
              onMoveProduct={handleMoveProduct}
              onBatchUpdateStatus={handleBatchUpdateProductStatus}
              onBatchDeleteProducts={handleBatchDeleteProducts}
            />
          )}

          <footer className="site-footer">
            <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
              豫ICP备2026032303号-1
            </a>
          </footer>
        </main>
      </div>
    </div>
  )
}

export default App
