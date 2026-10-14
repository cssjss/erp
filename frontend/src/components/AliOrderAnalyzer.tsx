import { useState } from 'react'
import * as XLSX from 'xlsx'

const TARGET_STATUSES = new Set(['等待买家确认收货', '交易成功'])

interface AnalyzeResult {
  matchedCount: number
  totalPaid: number
  fileName: string
}

function parsePaidAmount(value: unknown) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim()
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

export function AliOrderAnalyzer() {
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedFileName, setSelectedFileName] = useState('')

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setSelectedFileName(file.name)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = workbook.SheetNames[0]

      if (!firstSheetName) {
        throw new Error('Excel 中没有可读取的工作表。')
      }

      const sheet = workbook.Sheets[firstSheetName]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

      if (rows.length === 0) {
        throw new Error('Excel 中没有数据。')
      }

      const filteredRows = rows.filter((row) => TARGET_STATUSES.has(String(row['订单状态'] || '').trim()))

      const totalPaid = filteredRows.reduce((sum, row) => {
        return sum + parsePaidAmount(row['实付款(元）'] ?? row['实付款(元)'])
      }, 0)

      setResult({
        matchedCount: filteredRows.length,
        totalPaid,
        fileName: file.name,
      })
    } catch (analyzeError: any) {
      setError(analyzeError?.message || 'Excel 识别失败，请检查表头名称和文件格式。')
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="content-stack">
      <section className="panel panel--form">
        <div className="panel__header">
          <h2>阿里订单识别</h2>
          <p>上传 Excel 后，筛选订单状态为“等待买家确认收货”和“交易成功”的订单，并统计实付款总和。</p>
        </div>

        <div className="ali-upload">
          <label className="file-upload-control">
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} disabled={loading} />
            <span className="file-upload-control__button">
              {loading ? '识别中...' : '上传 Excel 文件'}
            </span>
            <span className="file-upload-control__name">{selectedFileName || '未选择文件'}</span>
          </label>

          <div className="ali-upload__hint">
            <span>筛选状态：等待买家确认收货 / 交易成功</span>
            <span>统计列：实付款(元）</span>
          </div>

          {loading ? <p className="empty-hint">正在识别 Excel，请稍候...</p> : null}
          {error ? <div className="error-banner error-banner--inline">{error}</div> : null}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>识别结果</h2>
          <p>展示匹配到的订单数和实付款总和。</p>
        </div>

        {result ? (
          <div className="ali-result">
            <div className="ali-result__meta">
              <span>文件：{result.fileName}</span>
            </div>
            <div className="ali-result__cards">
              <div className="ali-result__card">
                <strong>{result.matchedCount}</strong>
                <span>匹配订单个数</span>
              </div>
              <div className="ali-result__card">
                <strong>{result.totalPaid.toFixed(2)}</strong>
                <span>实付款总和(元)</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="empty-hint">上传文件后，这里会展示筛选结果。</p>
        )}
      </section>
    </div>
  )
}
