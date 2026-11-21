import React from 'react'
import type { Transacao } from '@/types/financial'
import { formatBRLPublic } from '@/lib/format'

interface CategoryDetailProps {
  nome: string
  cor: string
  valor: number
  /** Total de despesas do mês (para o percentual). */
  total: number
  itens: Transacao[]
  onClose: () => void
}

/** Lista dos gastos de uma categoria selecionada no donut. */
export const CategoryDetail: React.FC<CategoryDetailProps> = ({
  nome,
  cor,
  valor,
  total,
  itens,
  onClose,
}) => {
  const pct = total > 0 ? ((valor / total) * 100).toFixed(1).replace('.', ',') : '0'
  return (
    <section className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cor }} />
          <h3 className="text-sm font-black text-[#1F1438] truncate">{nome}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-bold text-[#6639A6] hover:underline shrink-0"
        >
          Fechar
        </button>
      </div>

      <p className="text-[11px] text-gray-500 mb-3">
        {pct}% da sua renda deste mês •{' '}
        <strong className="text-[#1F1438]">{formatBRLPublic(valor)}</strong>
      </p>

      {itens.length === 0 ? (
        <p className="py-4 text-center text-xs text-gray-400">
          Nenhum gasto detalhado nesta categoria no mês.
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {itens.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2.5">
              <span className="text-xs font-semibold text-[#1F1438] truncate min-w-0">
                {t.descricao}
              </span>
              <span className="text-xs font-black text-rose-600 tabular-nums shrink-0">
                − {formatBRLPublic(t.valor)}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
