import { useEffect, useMemo, useState } from 'react'
import type { LossRecord, LossRecordPayload } from '../types'
import { Modal } from './Modal'
import {
  ResizableColGroup,
  ResizableTableHeader,
} from './ResizableTable'
import { useResizableColumns } from './useResizableColumns'
import type { ResizableColumnDefinition } from './useResizableColumns'

interface LossRecordManagerProps {
  records: LossRecord[]
  loading: boolean
  filterDateFrom: string
  filterDateTo: string
  filterKeyword: string
  onFilterChange: (filters: { dateFrom: string; dateTo: string; keyword: string }) => void
  onCreateRecord: (payload: LossRecordPayload) => Promise<void>
  onUpdateRecord: (recordId: number, payload: LossRecordPayload) => Promise<void>
  onDeleteRecord: (recordId: number) => Promise<void>
  onBatchDeleteRecords: (recordIds: number[]) => Promise<void>
}

interface LossRecordFormState {
  reason: string
  lossAmount: number
  shippingLoss: number
  otherLoss: number
  note: string
  lossDate: string
}

const LOSS_TABLE_COLUMNS: ResizableColumnDefinition[] = [
  { key: 'select', defaultWidth: 52, minWidth: 48, maxWidth: 80 },
  { key: 'reason', defaultWidth: 180, minWidth: 110 },
  { key: 'loss-amount', defaultWidth: 120, minWidth: 96 },
  { key: 'shipping-loss', defaultWidth: 120, minWidth: 96 },
  { key: 'other-loss', defaultWidth: 120, minWidth: 96 },
  { key: 'date', defaultWidth: 130, minWidth: 110 },
  { key: 'actions', defaultWidth: 130, minWidth: 110 },
  { key: 'note', defaultWidth: 200, minWidth: 110 },
]

function getTodayLocalDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function buildInitialForm(): LossRecordFormState {
  return {
    reason: '',
    lossAmount: 0,
    shippingLoss: 0,
    otherLoss: 0,
    note: '',
    lossDate: getTodayLocalDate(),
  }
}

export function LossRecordManager({
  records,
  loading,
  filterDateFrom,
  filterDateTo,
  filterKeyword,
  onFilterChange,
  onCreateRecord,
  onUpdateRecord,
  onDeleteRecord,
  onBatchDeleteRecords,
}: LossRecordManagerProps) {
  const [formState, setFormState] = useState<LossRecordFormState>(buildInitialForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRecordIds, setSelectedRecordIds] = useState<number[]>([])
  const tableResize = useResizableColumns('erp-table-widths:loss-records', LOSS_TABLE_COLUMNS)

  useEffect(() => {
    setSelectedRecordIds([])
  }, [records])

  const totalLossAmount = useMemo(
    () => records.reduce((sum, record) => sum + Number(record.lossAmount || 0), 0),
    [records],
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload: LossRecordPayload = {
      reason: formState.reason.trim(),
      lossAmount: Number(formState.lossAmount) || 0,
      shippingLoss: Number(formState.shippingLoss) || 0,
      otherLoss: Number(formState.otherLoss) || 0,
      note: formState.note.trim(),
      lossDate: formState.lossDate,
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

  function beginEdit(record: LossRecord) {
    setEditingId(record.id)
    setFormState({
      reason: record.reason,
      lossAmount: record.lossAmount,
      shippingLoss: record.shippingLoss,
      otherLoss: record.otherLoss,
      note: record.note,
      lossDate: record.lossDate,
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
    const confirmed = window.confirm('确认删除这条亏损记录吗？删除后不可恢复。')

    if (!confirmed) {
      return
    }

    await onDeleteRecord(recordId)
  }

  async function handleBatchDelete() {
    if (selectedRecordIds.length === 0) {
      return
    }

    const confirmed = window.confirm(`确认批量删除已选中的 ${selectedRecordIds.length} 条亏损记录吗？`)

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

  const allSelected = records.length > 0 && selectedRecordIds.length === records.length

  return (
    <div className="content-stack">
      <section className="panel">
        <div className="panel__header product-list-header">
          <div>
            <h2>亏损数据表</h2>
            <p>支持按日期和内容筛选，表尾固定展示亏损金额合计。</p>
          </div>
          <button className="primary-button" type="button" onClick={openCreateModal}>
            新增记录
          </button>
        </div>

        <div className="loss-filters table-filters">
          <label className="field">
            <span>起始日期</span>
            <input type="date" value={filterDateFrom} onChange={(event) => onFilterChange({ dateFrom: event.target.value, dateTo: filterDateTo, keyword: filterKeyword })} />
          </label>
          <label className="field">
            <span>结束日期</span>
            <input type="date" value={filterDateTo} onChange={(event) => onFilterChange({ dateFrom: filterDateFrom, dateTo: event.target.value, keyword: filterKeyword })} />
          </label>
          <label className="field field--wide">
            <span>内容筛选</span>
            <input value={filterKeyword} onChange={(event) => onFilterChange({ dateFrom: filterDateFrom, dateTo: filterDateTo, keyword: event.target.value })} placeholder="输入亏损原因或备注" />
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
                      setSelectedRecordIds(event.target.checked ? records.map((record) => record.id) : [])
                    }
                  />
                </ResizableTableHeader>
                <ResizableTableHeader columnKey="reason" label="亏损原因" resize={tableResize} />
                <ResizableTableHeader columnKey="loss-amount" label="亏损金额" resize={tableResize} />
                <ResizableTableHeader columnKey="shipping-loss" label="运费亏损" resize={tableResize} />
                <ResizableTableHeader columnKey="other-loss" label="其他亏损" resize={tableResize} />
                <ResizableTableHeader columnKey="date" label="亏损日期" resize={tableResize} />
                <ResizableTableHeader columnKey="actions" label="操作" resize={tableResize} />
                <ResizableTableHeader columnKey="note" label="备注" resize={tableResize} />
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td className="table-empty" colSpan={8}>
                    暂无符合条件的亏损记录。
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td data-label="选择">
                      <input
                        type="checkbox"
                        checked={selectedRecordIds.includes(record.id)}
                        onChange={() => toggleRecordSelection(record.id)}
                      />
                    </td>
                    <td data-label="亏损原因">{record.reason}</td>
                    <td data-label="亏损金额">{record.lossAmount.toFixed(2)}</td>
                    <td data-label="运费亏损">{record.shippingLoss.toFixed(2)}</td>
                    <td data-label="其他亏损">{record.otherLoss.toFixed(2)}</td>
                    <td data-label="亏损日期">{record.lossDate}</td>
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
              {records.length > 0 ? (
                <tr className="table-summary">
                  <td data-label="合计" colSpan={2}>合计</td>
                  <td data-label="亏损金额合计">{totalLossAmount.toFixed(2)}</td>
                  <td data-label="运费亏损">-</td>
                  <td data-label="其他亏损">-</td>
                  <td data-label="亏损日期">-</td>
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
        title={editingId === null ? '新增亏损记录' : '编辑亏损记录'}
        description="填写亏损原因、金额和日期后保存。"
        busy={loading}
        onClose={cancelEdit}
      >
        <form className="loss-form modal-form" onSubmit={handleSubmit}>
          <div className="dynamic-fields">
            <label className="field"><span>亏损原因</span><input value={formState.reason} onChange={(event) => setFormState((current) => ({ ...current, reason: event.target.value }))} placeholder="请输入亏损原因" /></label>
            <label className="field"><span>亏损金额</span><input type="number" step="0.01" value={formState.lossAmount} onChange={(event) => setFormState((current) => ({ ...current, lossAmount: Number(event.target.value) || 0 }))} /></label>
            <label className="field"><span>运费亏损</span><input type="number" step="0.01" value={formState.shippingLoss} onChange={(event) => setFormState((current) => ({ ...current, shippingLoss: Number(event.target.value) || 0 }))} /></label>
            <label className="field"><span>其他亏损</span><input type="number" step="0.01" value={formState.otherLoss} onChange={(event) => setFormState((current) => ({ ...current, otherLoss: Number(event.target.value) || 0 }))} /></label>
            <label className="field"><span>亏损日期</span><input type="date" value={formState.lossDate} onChange={(event) => setFormState((current) => ({ ...current, lossDate: event.target.value }))} /></label>
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
