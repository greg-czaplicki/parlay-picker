import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export function PlayerTableSkeleton({ rows = 10, columns = 8 }: { rows?: number; columns?: number }) {
  return (
    <div className="relative w-full overflow-x-auto rounded-lg border border-gray-800 bg-background" aria-busy="true" aria-label="Loading player stats" role="status">
      <Table className="min-w-[700px] animate-pulse">
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i} className="bg-muted h-10">
                <div className="h-4 w-20 bg-gray-700 rounded" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <TableCell key={colIdx}>
                  <div className="h-4 w-full bg-gray-800 rounded" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
} 