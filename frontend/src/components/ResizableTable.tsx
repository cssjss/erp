import type { ReactNode, ThHTMLAttributes } from 'react'
import type { ResizableColumnsController } from './useResizableColumns'

export function ResizableColGroup({ resize }: { resize: ResizableColumnsController }) {
  return (
    <colgroup>
      {resize.columns.map((column) => (
        <col key={column.key} style={{ width: column.width }} />
      ))}
    </colgroup>
  )
}

interface ResizableTableHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  columnKey: string
  label: string
  resize: ResizableColumnsController
  children?: ReactNode
}

export function ResizableTableHeader({
  columnKey,
  label,
  resize,
  className,
  children,
  ...props
}: ResizableTableHeaderProps) {
  return (
    <th
      {...props}
      className={className ? `resizable-table-header ${className}` : 'resizable-table-header'}
    >
      {children ?? label}
      <span {...resize.getResizeHandleProps(columnKey, label)} />
    </th>
  )
}
