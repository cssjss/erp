import { useState } from 'react'
import type { Category } from '../types'

interface SpecBuilderProps {
  selectedCategory: Category | null
  onCreateCategory: (payload: { name: string; specs: string[] }) => Promise<void>
  onDeleteCategory: (categoryId: number) => Promise<void>
  loading: boolean
}

export function SpecBuilder({
  selectedCategory,
  onCreateCategory,
  onDeleteCategory,
  loading,
}: SpecBuilderProps) {
  const [categoryName, setCategoryName] = useState('')
  const [specInputs, setSpecInputs] = useState([''])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const specs = specInputs.map((item) => item.trim()).filter(Boolean)

    await onCreateCategory({
      name: categoryName.trim(),
      specs,
    })

    setCategoryName('')
    setSpecInputs([''])
  }

  function updateSpec(index: number, value: string) {
    setSpecInputs((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  function addSpecField() {
    setSpecInputs((current) => [...current, ''])
  }

  function removeSpecField(index: number) {
    setSpecInputs((current) => {
      if (current.length === 1) {
        return ['']
      }

      return current.filter((_, itemIndex) => itemIndex !== index)
    })
  }

  async function handleDeleteCategory() {
    if (!selectedCategory) {
      return
    }

    const confirmed = window.confirm(
      `确认删除一级分类“${selectedCategory.name}”吗？该分类下的规格和产品数据也会一并删除。`,
    )

    if (!confirmed) {
      return
    }

    await onDeleteCategory(selectedCategory.id)
  }

  return (
    <div className="content-grid">
      <section className="panel panel--form">
        <div className="panel__header">
          <p className="panel__eyebrow">规格录入</p>
          <h2>创建一级分类和子规格</h2>
          <p>例如一级分类为“手机壳”，可继续添加“颜色”“型号”“大小”等子规格。</p>
        </div>

        <form className="form-stack" onSubmit={handleSubmit}>
          <label className="field">
            <span>一级分类</span>
            <input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="例如：手机壳"
            />
          </label>

          <div className="field-group">
            <div className="field-group__header">
              <span>子规格</span>
              <button type="button" className="ghost-button" onClick={addSpecField}>
                添加子规格
              </button>
            </div>

            {specInputs.map((spec, index) => (
              <div key={index} className="inline-field">
                <input
                  value={spec}
                  onChange={(event) => updateSpec(index, event.target.value)}
                  placeholder={`子规格 ${index + 1}`}
                />
                <button  type="button" className="remove-button" onClick={() => removeSpecField(index)}>
                  删除
                </button>
              </div>
            ))}
          </div>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? '提交中...' : '保存分类'}
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel__header">
          <p className="panel__eyebrow">分类预览</p>
          <h2>{selectedCategory ? `${selectedCategory.name} 规格表` : '还没有选中分类'}</h2>
          <p>点击左侧一级分类后，这里展示当前分类的规格结构。</p>
        </div>

        {selectedCategory ? (
          <>
            <div className="spec-preview-actions">
              <button className="text-action text-action--delete" type="button" onClick={handleDeleteCategory}>
                删除当前一级分类
              </button>
            </div>

            <div className="tag-row">
              {selectedCategory.specs.map((spec) => (
                <span key={spec.id} className="tag-chip">
                  {spec.name}
                </span>
              ))}
            </div>

            <div className="preview-table">
              <div className="preview-table__head">
                {selectedCategory.specs.map((spec) => (
                  <span key={spec.id}>{spec.name}</span>
                ))}
              </div>
              <div className="preview-table__body">
                <p>当前分类下录入的产品表头将按这些子规格动态生成。</p>
              </div>
            </div>
          </>
        ) : (
          <p className="empty-hint">创建分类后，点击左侧导航即可查看该分类的规格表。</p>
        )}
      </section>
    </div>
  )
}
