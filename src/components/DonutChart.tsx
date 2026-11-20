import React, { useMemo } from 'react'

interface CategorySlice {
  nome: string
  cor: string
  valor: number
  percentual: number
}

interface DonutChartProps {
  data: CategorySlice[]
  total: number
  size?: number
  strokeWidth?: number
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  total,
  size = 220,
  strokeWidth = 32,
}) => {
  const center = size / 2
  const radius = center - strokeWidth / 2
  const circumference = 2 * Math.PI * radius

  const slices = useMemo(() => {
    if (total === 0 || data.length === 0) return []

    let accumulatedAngle = 0
    return data.map((item) => {
      const strokeDasharray = `${(item.percentual / 100) * circumference} ${circumference}`
      const strokeDashoffset = -accumulatedAngle
      accumulatedAngle += (item.percentual / 100) * circumference

      return {
        ...item,
        strokeDasharray,
        strokeDashoffset,
      }
    })
  }, [data, total, circumference])

  if (total === 0 || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="animate-fade-in">
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#E9E3F5"
            strokeWidth={strokeWidth}
          />
        </svg>
        <p className="text-xs text-gray-400 mt-2 font-medium">
          Sem despesas registradas no período
        </p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90 transform transition-all duration-700 ease-out"
        >
          {/* Fundo do círculo */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="#F1ECF9"
            strokeWidth={strokeWidth}
          />

          {/* Fatias das categorias com cantos arredondados sutis */}
          {slices.map((slice, i) => (
            <circle
              key={slice.nome + i}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={slice.cor || '#8B5CF6'}
              strokeWidth={strokeWidth}
              strokeDasharray={slice.strokeDasharray}
              strokeDashoffset={slice.strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out hover:opacity-85"
            />
          ))}
        </svg>

        {/* Centro do donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-gray-500">
            Total Despesas
          </span>
          <span className="text-base sm:text-lg font-black text-[#1F1438] mt-0.5">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
          </span>
          <span className="text-[10px] text-[#6639A6] font-medium mt-0.5">
            {data.length} {data.length === 1 ? 'categoria' : 'categorias'}
          </span>
        </div>
      </div>

      {/* Legenda animada abaixo do donut */}
      <div className="w-full mt-4 grid grid-cols-2 gap-2 text-xs">
        {data.slice(0, 6).map((item, idx) => (
          <div
            key={idx}
            className="flex items-center gap-1.5 p-1.5 rounded-lg bg-white/60 border border-purple-100/80"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
              style={{ backgroundColor: item.cor || '#8B5CF6' }}
            />
            <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
              <span className="truncate text-gray-700 font-medium text-[11px]">{item.nome}</span>
              <span className="text-gray-900 font-bold text-[11px]">
                {item.percentual.toFixed(0)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
