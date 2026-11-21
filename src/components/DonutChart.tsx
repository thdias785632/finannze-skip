import React, { useEffect, useMemo, useState } from 'react'

export interface DonutSlice {
  /** Identificador estável da fatia (id da categoria). */
  id?: string
  label: string
  value: number
  color: string
}

interface DonutChartProps {
  /** Rótulo do centro quando nenhuma fatia está selecionada (ex.: "Total"). */
  centerLabel: string
  /** Valor central quando nenhuma fatia está selecionada. */
  centerValue: number
  /** Fatias ordenadas (maior → menor). */
  slices: DonutSlice[]
  /** Chamado quando o usuário toca numa fatia ou num item da legenda. */
  onSelectSlice?: (id: string) => void
  /** Fatia atualmente selecionada (controlado pelo pai). */
  selectedId?: string | null
}

const GAP_ANGLE = 1.5

const DonutChart: React.FC<DonutChartProps> = ({
  centerLabel,
  centerValue,
  slices,
  onSelectSlice,
  selectedId = null,
}) => {
  const [internalActive, setInternalActive] = useState<number | null>(null)

  // Se o pai controla a seleção por id, sincroniza; senão usa o estado interno.
  const controlledIndex =
    selectedId && slices.length > 0 ? slices.findIndex((s) => s.id === selectedId) : -1
  const active = controlledIndex >= 0 ? controlledIndex : internalActive

  // Fatia selecionada pelo pai — o estado interno só vale quando o pai
  // não controla a seleção (senão as duas fontes brigam).
  useEffect(() => {
    if (selectedId === null) setInternalActive(null)
  }, [selectedId])

  const setActive = (index: number | null) => {
    setInternalActive(index)
    if (onSelectSlice) {
      const slice = index !== null ? slices[index] : null
      if (slice?.id) onSelectSlice(slice.id)
      else if (index === null) onSelectSlice('')
    }
  }

  const total = useMemo(() => slices.reduce((acc, s) => acc + s.value, 0), [slices])

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const arcs = useMemo(() => {
    const list: {
      start: number
      end: number
      mid: number
      fraction: number
      slice: DonutSlice
      index: number
    }[] = []
    let cursor = 0
    slices.forEach((slice, index) => {
      const fraction = centerValue > 0 ? slice.value / centerValue : 0
      const sweep = fraction * 360
      list.push({
        start: cursor,
        end: cursor + sweep,
        mid: cursor + sweep / 2,
        fraction,
        slice,
        index,
      })
      cursor += sweep
    })
    return list
  }, [slices, centerValue])

  const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  const arcPath = (rIn: number, rOut: number, startDeg: number, endDeg: number) => {
    const cx = 100
    const cy = 100
    const largeArc = endDeg - startDeg > 180 ? 1 : 0
    const p1 = polar(cx, cy, rOut, startDeg)
    const p2 = polar(cx, cy, rOut, endDeg)
    const p3 = polar(cx, cy, rIn, endDeg)
    const p4 = polar(cx, cy, rIn, startDeg)
    return [
      `M ${p1.x} ${p1.y}`,
      `A ${rOut} ${rOut} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
      `L ${p3.x} ${p3.y}`,
      `A ${rIn} ${rIn} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
      'Z',
    ].join(' ')
  }

  const R_OUT = 86
  const R_IN = 56

  return (
    <div className="space-y-4">
      {/* Donut */}
      <div className="relative mx-auto" style={{ width: 200, height: 200 }}>
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {arcs.map(({ start, end, mid, fraction, slice, index }) => {
            if (fraction <= 0) return null
            const isActive = active === index
            const dimmed = active !== null && !isActive
            const gap = GAP_ANGLE
            // Fatia ativa cresce para fora; demais encolhem um pouco
            const rOut = isActive ? R_OUT + 5 : R_OUT - (active !== null ? 2 : 0)
            const rIn = isActive ? R_IN + 2 : R_IN
            const path = arcPath(
              rIn,
              rOut,
              start + gap / 2,
              Math.max(end - gap / 2, start + gap / 2 + 0.5),
            )
            return (
              <path
                key={slice.id || slice.label}
                d={path}
                fill={slice.color}
                opacity={dimmed ? 0.35 : 1}
                onClick={() => setActive(isActive ? null : index)}
                className="cursor-pointer transition-all duration-200"
                style={{
                  transformOrigin: '100px 100px',
                  transform:
                    mid !== undefined && isActive
                      ? `translate(${Math.cos(((mid - 90) * Math.PI) / 180) * 3}px, ${Math.sin(((mid - 90) * Math.PI) / 180) * 3}px)`
                      : undefined,
                }}
              />
            )
          })}
        </svg>

        {/* Centro do donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-6">
          {active === null ? (
            <>
              <span className="text-[11px] font-semibold text-[#6B7280]">{centerLabel}</span>
              <span className="text-base font-black text-[#1F1438] leading-tight">
                {formatBRL(centerValue)}
              </span>
              <span className="text-[10px] text-[#6639A6] font-medium mt-0.5">
                Toque numa fatia
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-semibold text-[#6B7280] truncate max-w-[110px]">
                {arcs[active].slice.label}
              </span>
              <span className="text-base font-black text-[#1F1438] leading-tight">
                {formatBRL(arcs[active].slice.value)}
              </span>
              <span className="text-[10px] text-[#6639A6] font-medium mt-0.5">
                {(arcs[active].fraction * 100).toFixed(1).replace('.', ',')}% da sua renda
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="divide-y divide-gray-100">
        {arcs.map(({ slice, fraction, index }) => (
          <button
            key={slice.id || slice.label}
            type="button"
            onClick={() => setActive(active === index ? null : index)}
            className={`w-full flex items-center justify-between py-2.5 px-1 transition rounded-lg ${
              active === index ? 'bg-[#F6F3FB]' : 'hover:bg-gray-50'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-xs font-semibold text-[#1F1438] truncate">{slice.label}</span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-gray-400 font-medium tabular-nums">
                {(fraction * 100).toFixed(1).replace('.', ',')}%
              </span>
              <span className="text-xs font-black text-[#1F1438] tabular-nums">
                {formatBRL(slice.value)}
              </span>
              <svg
                className={`w-3.5 h-3.5 transition ${active === index ? 'text-[#6639A6]' : 'text-gray-400'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default DonutChart
export { DonutChart }
