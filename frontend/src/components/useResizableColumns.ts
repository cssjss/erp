import { useEffect, useRef, useState } from 'react'
import type {
  CSSProperties,
  HTMLAttributes,
  PointerEvent as ReactPointerEvent,
} from 'react'

export interface ResizableColumnDefinition {
  key: string
  defaultWidth: number
  minWidth?: number
  maxWidth?: number
}

interface DragState {
  key: string
  pointerId: number
  startX: number
  startWidth: number
}

export interface ResizableColumnsController {
  columns: Array<ResizableColumnDefinition & { width: number }>
  tableStyle: CSSProperties
  getResizeHandleProps: (key: string, label: string) => HTMLAttributes<HTMLSpanElement>
}

function clampWidth(width: number, definition: ResizableColumnDefinition) {
  const minWidth = definition.minWidth ?? 64
  const maxWidth = definition.maxWidth ?? 640
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)))
}

function readStoredWidths(storageKey: string, definitions: ResizableColumnDefinition[]) {
  const defaults = Object.fromEntries(
    definitions.map((definition) => [definition.key, definition.defaultWidth]),
  )

  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}') as Record<string, unknown>

    for (const definition of definitions) {
      const storedWidth = Number(stored[definition.key])

      if (Number.isFinite(storedWidth)) {
        defaults[definition.key] = clampWidth(storedWidth, definition)
      }
    }
  } catch {
    // Ignore invalid or unavailable browser storage and use the defaults.
  }

  return defaults
}

export function useResizableColumns(
  storageKey: string,
  definitions: ResizableColumnDefinition[],
): ResizableColumnsController {
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    readStoredWidths(storageKey, definitions),
  )
  const dragState = useRef<DragState | null>(null)

  useEffect(() => {
    setWidths(readStoredWidths(storageKey, definitions))
  }, [storageKey, definitions])

  function updateWidth(key: string, nextWidth: number) {
    const definition = definitions.find((column) => column.key === key)

    if (!definition) {
      return
    }

    setWidths((current) => {
      const next = { ...current, [key]: clampWidth(nextWidth, definition) }

      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        // Column resizing still works when browser storage is unavailable.
      }

      return next
    })
  }

  function stopResize(event: ReactPointerEvent<HTMLSpanElement>) {
    if (dragState.current?.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    dragState.current = null
  }

  function getResizeHandleProps(key: string, label: string): HTMLAttributes<HTMLSpanElement> {
    const definition = definitions.find((column) => column.key === key)

    return {
      className: 'column-resizer',
      role: 'separator',
      tabIndex: 0,
      title: `拖动调整“${label}”列宽，双击恢复默认宽度`,
      'aria-label': `调整“${label}”列宽`,
      'aria-orientation': 'vertical',
      onClick: (event) => event.stopPropagation(),
      onDoubleClick: (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (definition) {
          updateWidth(key, definition.defaultWidth)
        }
      },
      onKeyDown: (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        const step = event.shiftKey ? 32 : 8
        const currentWidth = widths[key] ?? definition?.defaultWidth ?? 100
        updateWidth(key, currentWidth + (event.key === 'ArrowRight' ? step : -step))
      },
      onPointerDown: (event) => {
        if (!definition) {
          return
        }

        event.preventDefault()
        event.stopPropagation()
        event.currentTarget.setPointerCapture(event.pointerId)
        dragState.current = {
          key,
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: widths[key] ?? definition.defaultWidth,
        }
      },
      onPointerMove: (event) => {
        const drag = dragState.current

        if (!drag || drag.pointerId !== event.pointerId || drag.key !== key) {
          return
        }

        updateWidth(key, drag.startWidth + event.clientX - drag.startX)
      },
      onPointerUp: stopResize,
      onPointerCancel: stopResize,
    }
  }

  const columns = definitions.map((definition) => ({
    ...definition,
    width: widths[definition.key] ?? definition.defaultWidth,
  }))
  const totalWidth = columns.reduce((sum, column) => sum + column.width, 0)

  return {
    columns,
    tableStyle: { '--erp-table-width': `${totalWidth}px` } as CSSProperties,
    getResizeHandleProps,
  }
}
