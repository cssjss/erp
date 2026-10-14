import { useEffect, useRef, useState } from 'react'
import type { AppView, Category } from '../types'

interface CategorySidebarProps {
  categories: Category[]
  selectedCategoryId: number | null
  selectedView: AppView
  collapsed: boolean
  mobileOpen: boolean
  onSelectCategory: (categoryId: number) => void
  onSelectView: (view: AppView) => void
  onReorderCategories: (categoryIds: number[]) => Promise<void>
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void
  onToggleCollapse: () => void
  onMobileClose: () => void
}

export function CategorySidebar({
  categories,
  selectedCategoryId,
  selectedView,
  collapsed,
  mobileOpen,
  onSelectCategory,
  onSelectView,
  onReorderCategories,
  onResizeStart,
  onToggleCollapse,
  onMobileClose,
}: CategorySidebarProps) {
  const [orderedCategories, setOrderedCategories] = useState(categories)
  const [draggingCategoryId, setDraggingCategoryId] = useState<number | null>(null)
  const [reordering, setReordering] = useState(false)
  const orderedCategoriesRef = useRef(categories)
  const initialOrderRef = useRef<number[]>([])

  useEffect(() => {
    if (draggingCategoryId !== null) {
      return
    }

    setOrderedCategories(categories)
    orderedCategoriesRef.current = categories
  }, [categories, draggingCategoryId])

  function updateLocalOrder(nextCategories: Category[]) {
    orderedCategoriesRef.current = nextCategories
    setOrderedCategories(nextCategories)
  }

  function handleDragStart(event: React.PointerEvent<HTMLButtonElement>, categoryId: number) {
    if (event.button !== 0 || reordering) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    initialOrderRef.current = orderedCategoriesRef.current.map((category) => category.id)
    setDraggingCategoryId(categoryId)
  }

  function handleDragMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (draggingCategoryId === null) {
      return
    }

    event.preventDefault()
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-category-id]')
    const targetId = Number(target?.dataset.categoryId)

    if (!target || !Number.isInteger(targetId) || targetId === draggingCategoryId) {
      return
    }

    const current = orderedCategoriesRef.current
    const draggedCategory = current.find((category) => category.id === draggingCategoryId)

    if (!draggedCategory) {
      return
    }

    const remaining = current.filter((category) => category.id !== draggingCategoryId)
    let targetIndex = remaining.findIndex((category) => category.id === targetId)

    if (targetIndex < 0) {
      return
    }

    const targetRect = target.getBoundingClientRect()
    if (event.clientY > targetRect.top + targetRect.height / 2) {
      targetIndex += 1
    }

    const nextCategories = [...remaining]
    nextCategories.splice(targetIndex, 0, draggedCategory)

    if (nextCategories.some((category, index) => category.id !== current[index]?.id)) {
      updateLocalOrder(nextCategories)
    }
  }

  async function handleDragEnd(event: React.PointerEvent<HTMLButtonElement>) {
    if (draggingCategoryId === null) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const nextIds = orderedCategoriesRef.current.map((category) => category.id)
    const changed = nextIds.some((id, index) => id !== initialOrderRef.current[index])
    setDraggingCategoryId(null)

    if (!changed) {
      return
    }

    setReordering(true)
    try {
      await onReorderCategories(nextIds)
    } finally {
      setReordering(false)
    }
  }

  function handleDragCancel(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    updateLocalOrder(categories)
    setDraggingCategoryId(null)
  }

  async function handleSortKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, categoryId: number) {
    if (reordering || !['ArrowUp', 'ArrowDown'].includes(event.key)) {
      return
    }

    event.preventDefault()
    const current = orderedCategoriesRef.current
    const currentIndex = current.findIndex((category) => category.id === categoryId)
    const nextIndex = event.key === 'ArrowUp' ? currentIndex - 1 : currentIndex + 1

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= current.length) {
      return
    }

    const nextCategories = [...current]
    const [movedCategory] = nextCategories.splice(currentIndex, 1)
    nextCategories.splice(nextIndex, 0, movedCategory)
    updateLocalOrder(nextCategories)
    setReordering(true)

    try {
      await onReorderCategories(nextCategories.map((category) => category.id))
    } finally {
      setReordering(false)
    }
  }

  return (
    <aside className={collapsed ? 'sidebar is-collapsed' : mobileOpen ? 'sidebar is-mobile-open' : 'sidebar'}>
      <button
        aria-label={collapsed ? '展开左侧导航栏' : '隐藏左侧导航栏'}
        className="sidebar__collapse-toggle"
        type="button"
        onClick={onToggleCollapse}
      >
        {collapsed ? '›' : '‹'}
      </button>

      <div className="sidebar__inner">
        <div className="sidebar__mobile-header">
          <strong>导航菜单</strong>
          <button type="button" className="sidebar__mobile-close" onClick={onMobileClose}>
            ×
          </button>
        </div>

        <div className="sidebar__panel">
          <p className="sidebar__label">功能区</p>
          <div className="view-switcher">
            <button
              className={selectedView === 'specs' ? 'is-active' : ''}
              type="button"
              onClick={() => onSelectView('specs')}
            >
              规格录入
            </button>
            {/* <button
              className={selectedView === 'products' ? 'is-active' : ''}
              type="button"
              onClick={() => onSelectView('products')}
            >
              产品录入和查看
            </button> */}
            <button
              className={selectedView === 'ali-orders' ? 'is-active' : ''}
              type="button"
              onClick={() => onSelectView('ali-orders')}
            >
              阿里订单识别
            </button>
            <button
              className={selectedView === 'qianniu-orders' ? 'is-active' : ''}
              type="button"
              onClick={() => onSelectView('qianniu-orders')}
            >
              千牛订单识别
            </button>
            <button
              className={selectedView === 'loss-records' ? 'is-active' : ''}
              type="button"
              onClick={() => onSelectView('loss-records')}
            >
              亏损记录
            </button>
            <button
              className={selectedView === 'gross-profit' ? 'is-active' : ''}
              type="button"
              onClick={() => onSelectView('gross-profit')}
            >
              毛利计算
            </button>
            <button
              className={selectedView === 'express-query' ? 'is-active' : ''}
              type="button"
              onClick={() => onSelectView('express-query')}
            >
              物流单号识别
            </button>
            <button
              className={selectedView === 'users' ? 'is-active' : ''}
              type="button"
              onClick={() => onSelectView('users')}
            >
              用户管理
            </button>
          </div>
        </div>

        <div className="sidebar__panel sidebar__panel--categories">
          <p className="sidebar__label">一级分类</p>
          <div className="category-list">
            {categories.length === 0 ? (
              <p className="empty-hint">先创建一级分类，左侧导航会自动展示。</p>
            ) : (
              orderedCategories.map((category) => (
                <div
                  key={category.id}
                  className={draggingCategoryId === category.id ? 'category-sort-item is-dragging' : 'category-sort-item'}
                  data-category-id={category.id}
                >
                  <button
                    className={selectedCategoryId === category.id ? 'category-pill is-active' : 'category-pill'}
                    type="button"
                    onClick={() => onSelectCategory(category.id)}
                  >
                    <span>{category.name}</span>
                    <small>{category.specs.length} 个子规格</small>
                  </button>
                  <button
                    className="category-drag-handle"
                    type="button"
                    aria-label={`拖拽调整“${category.name}”的顺序`}
                    title="按住拖拽排序，也可使用上下方向键"
                    disabled={reordering}
                    onPointerDown={(event) => handleDragStart(event, category.id)}
                    onPointerMove={handleDragMove}
                    onPointerUp={(event) => void handleDragEnd(event)}
                    onPointerCancel={handleDragCancel}
                    onKeyDown={(event) => void handleSortKeyDown(event, category.id)}
                  >
                    <span aria-hidden="true">⠿</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <button
          aria-label="调整导航栏宽度"
          className="sidebar__resizer"
          type="button"
          onPointerDown={onResizeStart}
        />
      </div>
    </aside>
  )
}
