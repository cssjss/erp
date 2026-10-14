import { Fragment, useEffect, useMemo, useState } from 'react'
import type { Category, ProductRecord, ProductStatus } from '../types'
import { Modal } from './Modal'
import {
  ResizableColGroup,
  ResizableTableHeader,
} from './ResizableTable'
import { useResizableColumns } from './useResizableColumns'
import type { ResizableColumnDefinition } from './useResizableColumns'

const STATUS_OPTIONS: ProductStatus[] = ['待寄回', '已寄回', '已到货', '已发出', '已完成']

interface ProductManagerProps {
  selectedCategory: Category | null
  products: ProductRecord[]
  loading: boolean
  onCreateProduct: (payload: {
    categoryId: number
    parentProductId?: number | null
    price: number
    quantity: number
    status: ProductStatus
    note: string
    specValues: Record<number, string>
  }) => Promise<void>
  onUpdateProduct: (
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
  ) => Promise<void>
  onUpdateStatus: (productId: number, status: ProductStatus) => Promise<void>
  onDeleteProduct: (productId: number) => Promise<void>
  onMoveProduct: (productId: number, direction: 'up' | 'down') => Promise<void>
  onBatchUpdateStatus: (productIds: number[], status: ProductStatus) => Promise<void>
  onBatchDeleteProducts: (productIds: number[]) => Promise<void>
}

interface ProductFormState {
  price: number
  quantity: number
  status: ProductStatus
  note: string
  specValues: Record<number, string>
}

const DEFAULT_PARENTS_PER_PAGE = 10
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function buildInitialForm(category: Category | null): ProductFormState {
  const specValues = (category?.specs || []).reduce<Record<number, string>>((acc, spec) => {
    acc[spec.id] = ''
    return acc
  }, {})

  return {
    price: 0,
    quantity: 0,
    status: '待寄回',
    note: '',
    specValues,
  }
}

export function ProductManager({
  selectedCategory,
  products,
  loading,
  onCreateProduct,
  onUpdateProduct,
  onUpdateStatus,
  onDeleteProduct,
  onMoveProduct,
  onBatchUpdateStatus,
  onBatchDeleteProducts,
}: ProductManagerProps) {
  const [formState, setFormState] = useState<ProductFormState>(buildInitialForm(selectedCategory))
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createParentProductId, setCreateParentProductId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingState, setEditingState] = useState<ProductFormState>(buildInitialForm(selectedCategory))
  const [searchKeyword, setSearchKeyword] = useState('')
  const [collapsedParents, setCollapsedParents] = useState<Record<number, boolean>>({})
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PARENTS_PER_PAGE)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
  const productColumns = useMemo<ResizableColumnDefinition[]>(
    () => [
      { key: 'select', defaultWidth: 52, minWidth: 48, maxWidth: 80 },
      ...(selectedCategory?.specs || []).map((spec) => ({
        key: `spec-${spec.id}`,
        defaultWidth: 150,
        minWidth: 90,
      })),
      { key: 'status', defaultWidth: 110, minWidth: 96 },
      { key: 'price', defaultWidth: 110, minWidth: 88 },
      { key: 'quantity', defaultWidth: 90, minWidth: 72 },
      { key: 'actions', defaultWidth: 270, minWidth: 180 },
    { key: 'note', defaultWidth: 200, minWidth: 120 },
    ],
    [selectedCategory?.specs],
  )
  const tableResize = useResizableColumns(
    `erp-table-widths:products:${selectedCategory?.id ?? 'empty'}`,
    productColumns,
  )

  useEffect(() => {
    setFormState(buildInitialForm(selectedCategory))
    setCreateModalOpen(false)
    setCreateParentProductId(null)
    setEditingId(null)
    setEditingState(buildInitialForm(selectedCategory))
    setSearchKeyword('')
    setCollapsedParents({})
    setCurrentPage(1)
    setPageSize(DEFAULT_PARENTS_PER_PAGE)
    setSelectedProductIds([])
  }, [selectedCategory])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchKeyword])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedCategory) {
      return
    }

    await onCreateProduct({
      categoryId: selectedCategory.id,
      parentProductId: createParentProductId,
      price: formState.price,
      quantity: formState.quantity,
      status: formState.status,
      note: formState.note.trim(),
      specValues: formState.specValues,
    })

    setFormState(buildInitialForm(selectedCategory))
    setCreateModalOpen(false)
    setCreateParentProductId(null)
  }

  function openCreateModal(parentProductId: number | null = null) {
    if (!selectedCategory) {
      return
    }

    setCreateParentProductId(parentProductId)
    setFormState(buildInitialForm(selectedCategory))
    setCreateModalOpen(true)
  }

  function updateFormSpec(specId: number, value: string) {
    setFormState((current) => ({
      ...current,
      specValues: {
        ...current.specValues,
        [specId]: value,
      },
    }))
  }

  function updateEditingSpec(specId: number, value: string) {
    setEditingState((current) => ({
      ...current,
      specValues: {
        ...current.specValues,
        [specId]: value,
      },
    }))
  }

  function beginEdit(product: ProductRecord) {
    setEditingId(product.id)
    setEditingState({
      price: product.price,
      quantity: product.quantity,
      status: product.status,
      note: product.note,
      specValues: { ...product.specValues },
    })
  }

  async function saveEdit(productId: number) {
    if (!selectedCategory) {
      return
    }

    const product = products.find((item) => item.id === productId)

    if (!product) {
      return
    }

    await onUpdateProduct(productId, {
      categoryId: selectedCategory.id,
      parentProductId: product.parentProductId,
      price: editingState.price,
      quantity: editingState.quantity,
      status: editingState.status,
      note: editingState.note.trim(),
      specValues: editingState.specValues,
    })

    setEditingId(null)
  }

  async function cycleStatus(product: ProductRecord) {
    const nextIndex = (STATUS_OPTIONS.indexOf(product.status) + 1) % STATUS_OPTIONS.length
    const nextStatus = STATUS_OPTIONS[nextIndex]
    await onUpdateStatus(product.id, nextStatus)
  }

  async function handleDelete(productId: number) {
    const confirmed = window.confirm('确认删除这条产品数据吗？删除后不可恢复。')

    if (!confirmed) {
      return
    }

    await onDeleteProduct(productId)
  }

  function handleAddChild(parent: ProductRecord) {
    openCreateModal(parent.id)
    setCollapsedParents((current) => ({ ...current, [parent.id]: false }))
  }

  function toggleParentCollapse(parentId: number) {
    setCollapsedParents((current) => ({
      ...current,
      [parentId]: !current[parentId],
    }))
  }

  const filteredProducts = products.filter((product) => {
    const keyword = searchKeyword.trim().toLowerCase()

    if (!keyword) {
      return true
    }

    const specText = (selectedCategory?.specs || [])
      .map((spec) => product.specValues[spec.id] || '')
      .join(' ')
      .toLowerCase()

    const noteText = (product.note || '').toLowerCase()
    const priceText = String(product.price || '')
    const statusText = product.status.toLowerCase()

    return (
      specText.includes(keyword) ||
      noteText.includes(keyword) ||
      priceText.includes(keyword) ||
      statusText.includes(keyword)
    )
  })

  const allChildrenByParent = products.reduce<Record<number, ProductRecord[]>>((acc, product) => {
    if (product.parentProductId === null) {
      return acc
    }

    if (!acc[product.parentProductId]) {
      acc[product.parentProductId] = []
    }

    acc[product.parentProductId].push(product)
    return acc
  }, {})

  const matchedProductIds = new Set(filteredProducts.map((product) => product.id))
  const parentProducts = products.filter((product) => {
    if (product.parentProductId !== null) {
      return false
    }

    if (matchedProductIds.has(product.id)) {
      return true
    }

    const children = allChildrenByParent[product.id] || []
    return children.some((child) => matchedProductIds.has(child.id))
  })

  const childProductsByParent = parentProducts.reduce<Record<number, ProductRecord[]>>((acc, parent) => {
    const children = allChildrenByParent[parent.id] || []
    acc[parent.id] = matchedProductIds.has(parent.id)
      ? children.filter((child) => matchedProductIds.has(child.id) || searchKeyword.trim() === '')
      : children.filter((child) => matchedProductIds.has(child.id))
    return acc
  }, {})
  const collapsibleParents = parentProducts.filter(
    (parent) => (allChildrenByParent[parent.id]?.length || 0) > 0,
  )
  const allParentsCollapsed =
    collapsibleParents.length > 0 &&
    collapsibleParents.every((parent) => collapsedParents[parent.id] === true)

  const totalPages = Math.max(1, Math.ceil(parentProducts.length / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const pagedParents = parentProducts.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize,
  )

  const visibleProducts = pagedParents.flatMap((parent) => {
    const children = childProductsByParent[parent.id] || []
    return [parent, ...children]
  })
  const totalQuantity = visibleProducts.reduce((sum, product) => sum + (Number(product.quantity) || 0), 0)
  const totalPrice = visibleProducts.reduce((sum, product) => sum + (Number(product.price) || 0), 0)
  const visibleProductIds = visibleProducts.map((product) => product.id)
  const visibleSelectedCount = visibleProductIds.filter((id) => selectedProductIds.includes(id)).length
  const allVisibleSelected = visibleProductIds.length > 0 && visibleSelectedCount === visibleProductIds.length

  function toggleProductSelection(productId: number) {
    setSelectedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    )
  }

  function toggleParentGroupSelection(parentId: number, checked: boolean) {
    const children = childProductsByParent[parentId] || []
    const targetIds = [parentId, ...children.map((child) => child.id)]

    setSelectedProductIds((current) => {
      if (checked) {
        return [...new Set([...current, ...targetIds])]
      }

      return current.filter((id) => !targetIds.includes(id))
    })
  }

  function toggleVisibleSelection(checked: boolean) {
    setSelectedProductIds((current) => {
      if (checked) {
        return [...new Set([...current, ...visibleProductIds])]
      }

      return current.filter((id) => !visibleProductIds.includes(id))
    })
  }

  function toggleAllParentsCollapse() {
    setCollapsedParents((current) => {
      const nextCollapsed = !allParentsCollapsed
      const nextState = { ...current }

      for (const parent of collapsibleParents) {
        nextState[parent.id] = nextCollapsed
      }

      return nextState
    })
  }

  async function handleBatchStatusChange(status: ProductStatus) {
    if (selectedProductIds.length === 0) {
      return
    }

    await onBatchUpdateStatus(selectedProductIds, status)
    setSelectedProductIds([])
  }

  async function handleBatchDelete() {
    if (selectedProductIds.length === 0) {
      return
    }

    const confirmed = window.confirm(`确认批量删除已选中的 ${selectedProductIds.length} 条产品数据吗？`)

    if (!confirmed) {
      return
    }

    await onBatchDeleteProducts(selectedProductIds)
    setSelectedProductIds([])
  }

  function renderRow(product: ProductRecord, isChild: boolean, childCount = 0) {
    const isEditing = editingId === product.id
    const isSelected = selectedProductIds.includes(product.id)
    const groupIds = [product.id, ...(childProductsByParent[product.id] || []).map((child) => child.id)]
    const groupSelectedCount = groupIds.filter((id) => selectedProductIds.includes(id)).length
    const parentChecked = groupIds.length > 0 && groupSelectedCount === groupIds.length
    const hasChildren = childCount > 0

    return (
      <tr
        key={product.id}
        className={
          isChild
            ? 'erp-row erp-row--child'
            : hasChildren
              ? 'erp-row erp-row--parent erp-row--collapsible'
              : 'erp-row erp-row--parent'
        }
        onClick={!isChild && !isEditing && hasChildren ? () => toggleParentCollapse(product.id) : undefined}
      >
        <td data-label="选择">
          <input
            type="checkbox"
            checked={isChild ? isSelected : parentChecked}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) =>
              isChild
                ? toggleProductSelection(product.id)
                : toggleParentGroupSelection(product.id, event.target.checked)
            }
          />
        </td>
        {selectedCategory?.specs.map((spec, specIndex) => (
          <td key={`${product.id}-${spec.id}`} data-label={spec.name}>
            {isEditing ? (
              <input
                value={editingState.specValues[spec.id] || ''}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => updateEditingSpec(spec.id, event.target.value)}
              />
            ) : specIndex === 0 ? (
              <div className={isChild ? 'row-label row-label--child' : 'row-label'}>
                {!isChild && hasChildren ? (
                  <span className={`row-toggle ${collapsedParents[product.id] ? 'is-collapsed' : ''}`}>▾</span>
                ) : null}
                {/* <span className="row-badge">子类</span> */}
                {isChild ? <span className="row-badge">子类</span> : null}
                <span>{product.specValues[spec.id] || '-'}</span>
              </div>
            ) : (
              product.specValues[spec.id] || '-'
            )}
          </td>
        ))}
        <td data-label="状态">
          {isEditing ? (
            <select
              value={editingState.status}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) =>
                setEditingState((current) => ({
                  ...current,
                  status: event.target.value as ProductStatus,
                }))
              }
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          ) : (
            <button
              className={`status-pill status-pill--${product.status}`}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                void cycleStatus(product)
              }}
            >
              {product.status}
            </button>
          )}
        </td>
        <td data-label="价格">
          {isEditing ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={editingState.price}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) =>
                setEditingState((current) => ({
                  ...current,
                  price: Math.max(0, Number(event.target.value) || 0),
                }))
              }
            />
          ) : (
            Number(product.price || 0).toFixed(2)
          )}
        </td>
        <td data-label="数量">
          {isEditing ? (
            <input
              type="number"
              min="0"
              value={editingState.quantity}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) =>
                setEditingState((current) => ({
                  ...current,
                  quantity: Math.max(0, Number(event.target.value) || 0),
                }))
              }
            />
          ) : (
            product.quantity
          )}
        </td>
        <td data-label="操作">
          <div className="row-actions">
            {!isChild && !isEditing ? (
              <>
              <span className="row-subcount">{childCount} 个子类</span>
                <button
                  className="text-action text-action--edit"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleAddChild(product)
                  }}
                >
                  增加子类
                </button>
                
                <button
                  className="text-action text-action--move"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void onMoveProduct(product.id, 'up')
                  }}
                >
                  上移
                </button>
                {/* <button
                  className="text-action text-action--move"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void onMoveProduct(product.id, 'down')
                  }}
                >
                  下移
                </button> */}
                
              </>
            ) : null}
            {isEditing ? (
              <>
                <button
                  className="text-action text-action--edit"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void saveEdit(product.id)
                  }}
                >
                  保存
                </button>
                <button
                  className="text-action text-action--delete"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setEditingId(null)
                  }}
                >
                  取消
                </button>
              </>
            ) : (
              <>
                <button
                  className="text-action text-action--edit"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    beginEdit(product)
                  }}
                >
                  编辑
                </button>
                <button
                  className="text-action text-action--delete"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    void handleDelete(product.id)
                  }}
                >
                  删除
                </button>
                  
              </>
            )}
          </div>
        </td>
        <td data-label="备注">
          {isEditing ? (
            <input
              value={editingState.note}
              maxLength={255}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) =>
                setEditingState((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
            />
          ) : (
            product.note || '-'
          )}
        </td>
      </tr>
    )
  }

  return (
    <div className="content-stack">
      <section className="panel">
        <div className="panel__header product-list-header">
          <div>
            <h2>{selectedCategory ? `${selectedCategory.name} 产品表格` : '请选择左侧一级分类'}</h2>
            <p>支持规格检索、分页和父子产品折叠。</p>
          </div>
          {selectedCategory ? (
            <button className="primary-button" type="button" onClick={() => openCreateModal()}>
              新增产品
            </button>
          ) : null}
        </div>

        {selectedCategory ? (
          <>
            <div className="table-toolbar">
              <button
                type="button"
                className="ghost-button"
                onClick={toggleAllParentsCollapse}
                disabled={collapsibleParents.length === 0}
              >
                {allParentsCollapsed ? '展开全部' : '全部折叠'}
              </button>
              <label className="table-search">
                <span>筛选</span>
                <input
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  placeholder="规格、状态、价格或备注"
                />
              </label>
            </div>
          </>
        ) : null}

        {selectedCategory ? (
          <>
            <div className="table-batchbar">
              <span>已选 {selectedProductIds.length} 条</span>
              <label className="table-page-size">
                <span>每页显示</span>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setCurrentPage(1)
                  }}
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option} 条
                    </option>
                  ))}
                </select>
              </label>
              <select
                value=""
                onChange={(event) => {
                  const nextStatus = event.target.value as ProductStatus
                  if (nextStatus) {
                    void handleBatchStatusChange(nextStatus)
                  }
                }}
                disabled={selectedProductIds.length === 0 || loading}
              >
                <option value="">批量修改状态</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="remove-button"
                onClick={() => void handleBatchDelete()}
                disabled={selectedProductIds.length === 0 || loading}
              >
                批量删除
              </button>
            </div>
          </>
        ) : null}

        {selectedCategory ? (
          <>
            <div className="table-wrap">
              <table className="erp-table erp-table--resizable" style={tableResize.tableStyle}>
                <ResizableColGroup resize={tableResize} />
                <thead>
                  <tr>
                  <ResizableTableHeader columnKey="select" label="选择" resize={tableResize}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => toggleVisibleSelection(event.target.checked)}
                    />
                  </ResizableTableHeader>
                  {selectedCategory.specs.map((spec) => (
                    <ResizableTableHeader
                      key={spec.id}
                      columnKey={`spec-${spec.id}`}
                      label={spec.name}
                      resize={tableResize}
                    />
                  ))}
                  <ResizableTableHeader columnKey="status" label="状态" resize={tableResize} />
                  <ResizableTableHeader columnKey="price" label="价格" resize={tableResize} />
                  <ResizableTableHeader columnKey="quantity" label="数量" resize={tableResize} />
                  <ResizableTableHeader columnKey="actions" label="操作" resize={tableResize} />
                  <ResizableTableHeader columnKey="note" label="备注" resize={tableResize} />
                  </tr>
                </thead>
                <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td className="table-empty" colSpan={selectedCategory.specs.length + 6}>
                      {products.length === 0 ? '当前分类下还没有产品数据。' : '没有匹配到检索结果。'}
                    </td>
                  </tr>
                ) : (
                  pagedParents.map((parent) => {
                    const children = childProductsByParent[parent.id] || []
                    const childCount = allChildrenByParent[parent.id]?.length || 0
                    const isCollapsed = collapsedParents[parent.id] ?? false

                    return (
                      <Fragment key={parent.id}>
                        {renderRow(parent, false, childCount)}
                        {!isCollapsed ? children.map((child) => renderRow(child, true)) : null}
                      </Fragment>
                    )
                  })
                )}
                {filteredProducts.length > 0 ? (
                  <tr className="table-summary">
                    <td data-label="合计" colSpan={selectedCategory.specs.length + 2}>合计</td>
                    <td data-label="价格合计">{totalPrice.toFixed(2)}</td>
                    <td data-label="数量合计">{totalQuantity}</td>
                    <td data-label="操作">-</td>
                    <td data-label="备注">-</td>
                  </tr>
                ) : null}
                </tbody>
              </table>
            </div>
            {parentProducts.length > pageSize ? (
              <div className="table-pagination">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={page === safeCurrentPage ? 'page-button is-active' : 'page-button'}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="empty-hint">选择左侧分类后，这里会切换到对应分类的产品表。</p>
        )}
      </section>

      <Modal
        open={createModalOpen}
        title={createParentProductId === null ? '新增产品' : '新增子产品'}
        description={selectedCategory ? `当前分类：${selectedCategory.name}` : undefined}
        busy={loading}
        onClose={() => setCreateModalOpen(false)}
      >
        <form className="product-form modal-form" onSubmit={handleSubmit}>
          <div className="dynamic-fields">
            {selectedCategory?.specs.map((spec) => (
              <label className="field" key={spec.id}>
                <span>{spec.name}</span>
                <input
                  value={formState.specValues[spec.id] || ''}
                  onChange={(event) => updateFormSpec(spec.id, event.target.value)}
                  placeholder={`请输入${spec.name}`}
                />
              </label>
            ))}
          </div>
          <div className="dynamic-fields dynamic-fields--meta">
            <label className="field">
              <span>价格</span>
              <input type="number" min="0" step="0.01" value={formState.price} onChange={(event) => setFormState((current) => ({ ...current, price: Math.max(0, Number(event.target.value) || 0) }))} />
            </label>
            <label className="field">
              <span>数量</span>
              <input type="number" min="0" value={formState.quantity} onChange={(event) => setFormState((current) => ({ ...current, quantity: Math.max(0, Number(event.target.value) || 0) }))} />
            </label>
            <label className="field">
              <span>状态</span>
              <select value={formState.status} onChange={(event) => setFormState((current) => ({ ...current, status: event.target.value as ProductStatus }))}>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label className="field">
              <span>备注</span>
              <input maxLength={255} value={formState.note} onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))} placeholder="可填写物流、补充说明等" />
            </label>
          </div>
          <div className="modal-form__actions">
            <button className="ghost-button" type="button" onClick={() => setCreateModalOpen(false)} disabled={loading}>取消</button>
            <button className="primary-button" type="submit" disabled={loading}>{loading ? '保存中...' : '保存产品'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
