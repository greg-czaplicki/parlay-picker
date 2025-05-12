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
          {["1", "2", "3", "4", "event_avg"].map((round) => (
            <label key={round} className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="roundFilter"
                value={round}
                checked={roundFilter === round}
                onChange={() => setRoundFilter(round)}
                className="form-radio h-4 w-4 text-primary focus:ring-primary border-gray-600 bg-gray-700"
              />
              <span className="text-sm capitalize">{round.replace("_", " ")}</span>
            </label>
          ))}
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