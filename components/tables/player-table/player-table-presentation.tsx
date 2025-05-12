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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table'
import { flexRender, Table as ReactTable, RowData } from '@tanstack/react-table'

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
    <div className="relative w-full overflow-x-auto rounded-lg border border-gray-800 bg-background">
      <Table role="table" aria-label={caption} className="min-w-[700px]">
        <TableCaption>{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id} role="row">
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} role="columnheader" scope="col">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={table.getAllColumns().length} className="text-center py-8 text-muted-foreground">
                No data available
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map(row => (
              <TableRow key={row.id} role="row">
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id} role="cell">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * Props for PlayerTablePresentation.
 * @template T - Row data type
 * @property table - TanStack Table instance
 * @property caption - Optional table caption for accessibility
 */ 