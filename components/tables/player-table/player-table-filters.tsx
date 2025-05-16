import type { FC } from 'react'

interface PlayerTableFiltersProps {
  // Tournament
  dataView: 'season' | 'tournament'
  roundFilter?: string
  setRoundFilter?: (round: string) => void
  eventOptions?: { event_id: number; event_name: string }[]
  selectedEventId?: number | null
  setSelectedEventId?: (id: number) => void
  // Season
  dataSource?: 'data_golf' | 'pga_tour'
  setDataSource?: (ds: 'data_golf' | 'pga_tour') => void
}

export const PlayerTableFilters: FC<PlayerTableFiltersProps> = ({
  dataView,
  roundFilter,
  setRoundFilter,
  eventOptions = [],
  selectedEventId,
  setSelectedEventId,
  dataSource,
  setDataSource,
}) => {
  return (
    <div className="flex flex-wrap gap-4 items-center mb-4">
      {dataView === 'tournament' && setRoundFilter && roundFilter && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-300 mr-2">Round:</span>
          <select
            value={roundFilter}
            onChange={e => setRoundFilter(e.target.value)}
            className="bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm"
          >
            <option value="live">Live</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
          </select>
        </div>
      )}
      {dataView === 'tournament' && setSelectedEventId && selectedEventId !== undefined && eventOptions.length > 1 && (
        <div>
          <label className="text-sm mr-2">Event:</label>
          <select
            value={selectedEventId ?? ''}
            onChange={e => setSelectedEventId(Number(e.target.value))}
            className="bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm"
          >
            {eventOptions.map(ev => (
              <option key={ev.event_id} value={ev.event_id}>{ev.event_name}</option>
            ))}
          </select>
        </div>
      )}
      {dataView === 'season' && setDataSource && dataSource && (
        <div>
          <label className="text-sm mr-2">Data Source:</label>
          <select
            value={dataSource}
            onChange={e => setDataSource(e.target.value as 'data_golf' | 'pga_tour')}
            className="bg-gray-800 text-white border border-gray-700 rounded px-2 py-1 text-sm"
          >
            <option value="pga_tour">PGA Tour</option>
            <option value="data_golf">Data Golf</option>
          </select>
        </div>
      )}
    </div>
  )
} 