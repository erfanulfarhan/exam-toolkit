import { useMemo, useState } from 'react'
import { LineChart } from 'lucide-react'
import { Card, Field, Select } from '@/components/ui'
import { BoundaryChart } from '@/components/BoundaryChart'
import { useApi } from '@/lib/api'
import { ForecastView } from '@/lib/types'

const CAPTION =
  'Nobody can know the next boundaries for certain: Pearson sets them from how the paper performed on the ' +
  'day. The dashed line is the single most likely mark, from a trend weighted toward recent sessions and ' +
  'corrected for the series of the year. Tested against 420 past boundaries by hiding the latest session ' +
  'and predicting it, it came within 1.8 marks on average, and within 4 marks nine times out of ten.'

export function IalForecast({ subject }: { subject: string }) {
  const [code, setCode] = useState<string | undefined>()
  const body = useMemo(() => ({ qual: 'IAL', subject, code }), [subject, code])
  const { data } = useApi<ForecastView>('/api/forecast', body, 120)

  if (!data || !data.series.length) return null

  return (
    <Card className="p-4 sm:p-5">
      <Header target={data.target} />
      <Field label="Unit">
        <Select
          value={data.code}
          onChange={(e) => setCode(e.target.value)}
          className="mb-4 sm:max-w-md"
        >
          {data.units.map((u) => <option key={u.code} value={u.code}>{u.label}</option>)}
        </Select>
      </Field>
      <BoundaryChart series={data.series} target={data.target} max={data.max} caption={CAPTION} />
    </Card>
  )
}

export function IgcseForecast({ subject, papers }: { subject: string; papers: string | null }) {
  const body = useMemo(() => ({ qual: 'IGCSE', subject, papers }), [subject, papers])
  const { data } = useApi<ForecastView>('/api/forecast', body, 120)

  if (!data || !data.series.length) return null

  return (
    <Card className="p-4 sm:p-5">
      <Header target={data.target} />
      <BoundaryChart series={data.series} target={data.target} max={data.max} caption={CAPTION} />
    </Card>
  )
}

function Header({ target }: { target: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <LineChart size={17} className="text-fuchsia-400" />
        <h2 className="font-display text-lg font-semibold tracking-tight">Boundary trend and {target} forecast</h2>
      </div>
      <p className="text-sm text-muted mt-1">
        Where the raw boundaries have been, and the mark each grade most likely lands on next series.
      </p>
    </div>
  )
}
