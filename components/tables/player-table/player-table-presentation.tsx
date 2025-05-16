/**
 * PlayerTablePresentation renders a fully accessible, responsive table using TanStack Table.
 * - Receives a TanStack Table instance and renders headers, rows, and cells.
 * - No data fetching or business logic.
 * - Responsive, accessible, and presentational only.
 *
 * @template T - Row data type
 * @param table - TanStack Table instance
 * @param caption - Optional table caption for accessibility
 */
import { flexRender, Table as ReactTable, RowData } from '@tanstack/react-table'
import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

export interface PlayerTablePresentationProps<T extends RowData> {
  table: ReactTable<T>
  /** Optional: Table caption for accessibility (screen readers) */
  caption?: string
}

export const PlayerTablePresentation = <T extends RowData>({
  table,
  caption = 'Player statistics table',
}: PlayerTablePresentationProps<T>) => {
  return (
    <div className="relative rounded-lg border border-gray-800 w-full overflow-hidden">
      <div className="max-h-[calc(100vh-22rem)] overflow-auto">
        <table className="w-full text-sm">
          {caption && <caption className="mt-4 text-sm text-muted-foreground">{caption}</caption>}
          <thead className="[&_tr]:border-b bg-[#1e1e23] sticky top-0 z-10">
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id} role="row">
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    role="columnheader"
                    scope="col"
                    className="h-12 px-4 text-left align-middle font-medium text-muted-foreground sticky top-0 bg-[#1e1e23] border-b border-gray-700"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {table.getRowModel().rows.length === 0 ? (
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <td 
                  colSpan={table.getAllColumns().length} 
                  className="p-4 align-middle text-center py-8 text-muted-foreground"
                >
                  No data available
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} role="row" className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} role="cell" className="p-4 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * Props for PlayerTablePresentation.
 * @template T - Row data type
 * @property table - TanStack Table instance
 * @property caption - Optional table caption for accessibility
 */