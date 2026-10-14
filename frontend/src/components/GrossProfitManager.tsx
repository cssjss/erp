import { useEffect, useMemo, useState } from 'react'
import type { GrossProfitRecord, GrossProfitRecordPayload } from '../types'
import { Modal } from './Modal'
import {
  ResizableColGroup,
  ResizableTableHeader,
} from './ResizableTable'
import { useResizableColumns } from './useResizableColumns'
import type { ResizableColumnDefinition } from './useResizableColumns'

interface GrossProfitManagerProps {
  records: GrossProfitRecord[]
  loading: boolean
  onCreateRecord: (payload: GrossProfitRecordPayload) => Promise<void>
  onUpdateRecord: (recordId: number, payload: GrossProfitRecordPayload) => Promise<void>
  onDeleteRecord: (recordId: number) => Promise<void>
  onBatchDeleteRecords: (recordIds: number[]) => Promise<void>
}

interface GrossProfitFormState {
  actualRevenue: number
  actualCost: number
  recordDate: string
  note: string
}

const GROSS_PROFIT_TABLE_COLUMNS: ResizableColumnDefinition[] = [
  { key: 'select', defaultWidth: 52, minWidth: 48, maxWidth: 80 },
  { key: 'revenue', defaultWidth: 160, minWidth: 120 },
  { key: 'cost', defaultWidth: 160, minWidth: 120 },
  { key: 'gross-profit', defaultWidth: 160, minWidth: 120 },
  { key: 'rate', defaultWidth: 110, minWidth: 90 },
  { key: 'date', defaultWidth: 130, minWidth: 110 },
  { key: 'actions', defaultWidth: 130, minWidth: 110 },
  { key: 'note', defaultWidth: 200, minWidth: 110 },
]

function buildInitialForm(): GrossProfitFormState {
  return {
    actualRevenue: 0,
    actualCost: 0,
    recordDate: '',
    note: '',
  }
}

function calculateGrossProfit(actualRevenue: number, actualCost: number) {
  const actualGrossProfit = Number((actualRevenue - actualCost).toFixed(2))
  const grossProfitRate =
    actualRevenue === 0 ? 0 : Number((((actualRevenue - actualCost) / actualRevenue) * 100).toFixed(2))

  return { actualGrossProfit, grossProfitRate }
}

export function GrossProfitManager({
  records,
  loading,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord,
  onBatchDeleteRecords,
}: GrossProfitManagerProps) {
  const [formState, setFormState] = useState<GrossProfitFormState>(buildInitialForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([])
  const tableResize = useResizableColumns(
    'erp-table-widths:gross-profit-records',
    GROSS_PROFIT_TABLE_COLUMNS,
  )

  useEffect(() => {
    setSelectedRecordIds([])
  }, [records])

  const visibleRecords = records.filter((record) => {
    const keyword = searchKeyword.trim().toLowerCase()
    return (
      !keyword ||
      record.recordDate.toLowerCase().includes(keyword) ||
      (record.note || '').toLowerCase().includes(keyword)
    )
  })

  const totalGrossProfit = useMemo(
    () => visibleRecords.reduce((sum, record) => sum + Number(record.actualGrossProfit || 0), 0),
    [visibleRecords],
  )

  const calculated = calculateGrossProfit(
    Number(formState.actualRevenue) || 0,
    Number(formState.actualCost) || 0,
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload: GrossProfitRecordPayload = {
      actualRevenue: Number(formState.actualRevenue) || 0,
      actualCost: Number(formState.actualCost) || 0,
      recordDate: formState.recordDate,
      note: formState.note.trim(),
    }

    if (editingId === null) {
      await onCreateRecord(payload)
    } else {
      await onUpdateRecord(editingId, payload)
    }

    setFormState(buildInitialForm())
    setEditingId(null)
    setModalOpen(false)
  }

  function beginEdit(record: GrossProfitRecord) {
    setEditingId(record.id)
    setFormState({
      actualRevenue: record.actualRevenue,
      actualCost: record.actualCost,
      recordDate: record.recordDate,
      note: record.note,
    })
    setModalOpen(true)
  }

  function cancelEdit() {
    setEditingId(null)
    setFormState(buildInitialForm())
    setModalOpen(false)
  }

  function openCreateModal() {
    setEditingId(null)
    setFormState(buildInitialForm())
    setModalOpen(true)
  }

  async function handleDelete(recordId: number) {
    const confirmed = window.confirm('确认删除这条毛利记录吗？删除后不可恢复。')

    if (!confirmed) {
      return
    }

    await onDeleteRecord(recordId)
  }

  async function handleBatchDelete() {
    if (selectedRecordIds.length === 0) {
      return
    }

    const confirmed = window.confirm(`确认批量删除已选中的 ${selectedRecordIds.length} 条毛利记录吗？`)

    if (!confirmed) {
      return
    }

    await onBatchDeleteRecords(selectedRecordIds)
    setSelectedRecordIds([])
  }

  function toggleRecordSelection(recordId: number) {
    setSelectedRecordIds((current) =>
      current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId],
    )
  }

  const allSelected = visibleRecords.length > 0 && visibleRecords.every((record) => selectedRecordIds.includes(record.id))

  return (
    <div className="content-stack">
      <section className="panel">
        <div className="panel__header product-list-header">
          <div>
            <h2>毛利数据表</h2>
            <p>支持按日期筛选，表尾固定展示实际毛利金额合计。</p>
          </div>
          <button className="primary-button" type="button" onClick={openCreateModal}>新增记录</button>
        </div>

        <div className="table-filters table-search-only">
          <label className="table-search">
            <span>筛选</span>
            <input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="输入日期或备注" />
          </label>
        </div>

        <div className="table-batchbar">
          <span>已选 {selectedRecordIds.length} 条</span>
          <button
            type="button"
            className="remove-button"
            onClick={() => void handleBatchDelete()}
            disabled={selectedRecordIds.length === 0 || loading}
          >
            批量删除
          </button>
        </div>

        <div className="table-wrap">
          <table className="erp-table erp-table--resizable" style={tableResize.tableStyle}>
            <ResizableColGroup resize={tableResize} />
            <thead>
              <tr>
                <ResizableTableHeader columnKey="select" label="选择" resize={tableResize}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelectedRecordIds(event.target.checked ? visibleRecords.map((record) => record.id) : selectedRecordIds.filter((id) => !visibleRecords.some((record) => record.id === id)))
                    }
                  />
                </ResizableTableHeader>
                <ResizableTableHeader columnKey="revenue" label="实际营业金额" resize={tableResize} />
                <ResizableTableHeader columnKey="cost" label="实际成本金额" resize={tableResize} />
                <ResizableTableHeader columnKey="gross-profit" label="实际毛利金额" resize={tableResize} />
                <ResizableTableHeader columnKey="rate" label="毛利率" resize={tableResize} />
                <ResizableTableHeader columnKey="date" label="日期" resize={tableResize} />
                <ResizableTableHeader columnKey="actions" label="操作" resize={tableResize} />
                <ResizableTableHeader columnKey="note" label="备注" resize={tableResize} />
              </tr>
            </thead>
            <tbody>
              {visibleRecords.length === 0 ? (
                <tr>
                  <td className="table-empty" colSpan={8}>
                    暂无毛利记录。
                  </td>
                </tr>
              ) : (
                visibleRecords.map((record) => (
                  <tr key={record.id}>
                    <td data-label="选择">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.includes(record.id)}
                        onChange={() => toggleRecordSelection(record.id)}
                      />
                    </td>
                    <td data-label="实际营业金额">{record.actualRevenue.toFixed(2)}</td>
                    <td data-label="实际成本金额">{record.actualCost.toFixed(2)}</td>
                    <td data-label="实际毛利金额">{record.actualGrossProfit.toFixed(2)}</td>
                    <td data-label="毛利率">{record.grossProfitRate.toFixed(2)}%</td>
                    <td data-label="日期">{record.recordDate}</td>
                    <td data-label="操作">
                      <div className="row-actions">
                        <button className="text-action text-action--edit" type="button" onClick={() => beginEdit(record)}>
                          编辑
                        </button>
                        <button
                          className="text-action text-action--delete"
                          type="button"
                          onClick={() => void handleDelete(record.id)}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                    <td data-label="备注">{record.note || '-'}</td>
                  </tr>
                ))
              )}
              {visibleRecords.length > 0 ? (
                <tr className="table-summary">
                  <td data-label="合计" colSpan={3}>合计</td>
                  <td data-label="实际毛利金额合计">{totalGrossProfit.toFixed(2)}</td>
                  <td data-label="毛利率">-</td>
                  <td data-label="日期">-</td>
                  <td data-label="操作">-</td>
                  <td data-label="备注">-</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title={editingId === null ? '新增毛利记录' : '编辑毛利记录'}
        description="输入营业金额和成本金额，毛利金额与毛利率会自动计算。"
        busy={loading}
        onClose={cancelEdit}
      >
        <form className="loss-form modal-form" onSubmit={handleSubmit}>
          <div className="dynamic-fields">
            <label className="field"><span>实际营业金额</span><input type="number" step="0.01" value={formState.actualRevenue} onChange={(event) => setFormState((current) => ({ ...current, actualRevenue: Number(event.target.value) || 0 }))} /></label>
            <label className="field"><span>实际成本金额</span><input type="number" step="0.01" value={formState.actualCost} onChange={(event) => setFormState((current) => ({ ...current, actualCost: Number(event.target.value) || 0 }))} /></label>
            <label className="field"><span>实际毛利金额</span><input value={calculated.actualGrossProfit.toFixed(2)} readOnly /></label>
            <label className="field"><span>毛利率</span><input value={`${calculated.grossProfitRate.toFixed(2)}%`} readOnly /></label>
            <label className="field"><span>日期</span><input type="date" value={formState.recordDate} onChange={(event) => setFormState((current) => ({ ...current, recordDate: event.target.value }))} /></label>
            <label className="field field--wide"><span>备注</span><input maxLength={255} value={formState.note} onChange={(event) => setFormState((current) => ({ ...current, note: event.target.value }))} placeholder="可填写补充说明" /></label>
          </div>
          <div className="modal-form__actions">
            <button className="ghost-button" type="button" onClick={cancelEdit} disabled={loading}>取消</button>
            <button className="primary-button" type="submit" disabled={loading}>{loading ? '保存中...' : editingId === null ? '保存记录' : '保存修改'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
