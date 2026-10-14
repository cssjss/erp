import { useState } from 'react'
import { queryExpress } from '../api/client'
import type { ExpressQueryResponse } from '../types'

interface QueryFormState {
  appkey: string
  number: string
  mobile: string
}

const DELIVERY_STATUS_LABELS: Record<number, string> = {
  0: '暂无轨迹',
  1: '在途中',
  2: '正在派件',
  3: '已签收',
  4: '派送失败',
  5: '疑难件',
  6: '退件签收',
}

function buildInitialForm(): QueryFormState {
  return {
    appkey: '0c32620ba379f263',
    number: '',
    mobile: '',
  }
}

export function ExpressTracker() {
  const [formState, setFormState] = useState<QueryFormState>(buildInitialForm())
  const [appkeyEditable, setAppkeyEditable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ExpressQueryResponse | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!formState.appkey.trim() || !formState.number.trim()) {
      setError('请输入 appkey 和快递单号。')
      return
    }

    try {
      setLoading(true)
      setError('')
      const response = await queryExpress({
        appkey: formState.appkey.trim(),
        number: formState.number.trim(),
        mobile: formState.mobile.trim(),
      })
      setResult(response)
    } catch (queryError: any) {
      setResult(null)
      setError(queryError?.response?.data?.message || '物流查询失败，请检查参数后重试。')
    } finally {
      setLoading(false)
    }
  }

  const traceList = result?.result.list || []
  const expressInfo = result?.result

  function handleEnableAppkeyEdit() {
    if (appkeyEditable) {
      return
    }

    const confirmed = window.confirm('请确定您是否有新的密钥')

    if (confirmed) {
      setAppkeyEditable(true)
    }
  }

  return (
    <div className="content-stack">
      <section className="panel panel--form">
        <div className="panel__header">
          <h2>物流单号识别</h2>
          <p>输入 appkey 和快递单号后自动识别快递公司，并展示物流轨迹。</p>
        </div>

        <form className="loss-form" onSubmit={handleSubmit}>
          <div className="dynamic-fields">
            <label className="field">
              <span>用户密钥 appkey</span>
              <div className="inline-field">
                <input
                  value={formState.appkey}
                  onChange={(event) => setFormState((current) => ({ ...current, appkey: event.target.value }))}
                  placeholder="请输入 appkey"
                  disabled={!appkeyEditable}
                />
                <button className="ghost-button" type="button" onClick={handleEnableAppkeyEdit}>
                  {appkeyEditable ? '可修改' : '更换密钥'}
                </button>
              </div>
            </label>

            <label className="field">
              <span>快递单号</span>
              <input
                value={formState.number}
                onChange={(event) => setFormState((current) => ({ ...current, number: event.target.value }))}
                placeholder="请输入快递单号"
              />
            </label>

            <label className="field">
              <span>快递类型</span>
              <input value="auto" readOnly />
            </label>
          </div>

          <div className="dynamic-fields dynamic-fields--meta">
            <label className="field field--wide">
              <span>收件人/寄件人手机号（顺丰快递/中通/跨越速运需要）</span>
              <input
                value={formState.mobile}
                onChange={(event) => setFormState((current) => ({ ...current, mobile: event.target.value }))}
                placeholder="可选填写手机号"
              />
            </label>
          </div>

          <div className="loss-form-actions">
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? '查询中...' : '查询物流'}
            </button>
          </div>
        </form>

        {error ? <div className="error-banner error-banner--inline">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h2>物流轨迹</h2>
          <p>展示快递公司、单号和每一条轨迹节点。</p>
        </div>

        {expressInfo ? (
          <div className="express-result">
            <div className="express-result__summary">
              <div className="express-result__brand">
                {expressInfo.logo ? (
                  <img src={expressInfo.logo} alt={expressInfo.typename} className="express-result__logo" />
                ) : null}
                <div className="express-result__meta">
                  <strong>{expressInfo.typename || expressInfo.type}</strong>
                  <span>单号：{expressInfo.number}</span>
                </div>
              </div>

              <div className="ali-upload__hint">
                <span>识别类型：{expressInfo.type || 'auto'}</span>
                <span>物流状态：{DELIVERY_STATUS_LABELS[expressInfo.deliverystatus] || '未知状态'}</span>
                <span>{expressInfo.issign === 1 ? '已签收' : '未签收'}</span>
              </div>
            </div>

            {traceList.length > 0 ? (
              <div className="express-timeline">
                {traceList.map((item, index) => (
                  <div className="express-timeline__item" key={`${item.time}-${index}`}>
                    <div className="express-timeline__time">{item.time}</div>
                    <div className="express-timeline__dot" />
                    <div className="express-timeline__status">{item.status}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-hint">当前单号暂无物流轨迹。</p>
            )}
          </div>
        ) : (
          <p className="empty-hint">查询后，这里会展示物流轨迹结果。</p>
        )}
      </section>
    </div>
  )
}
