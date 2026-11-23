import React, { useState } from 'react'
import { X } from 'lucide-react'
import { imoveisService } from '@/services/imoveis'
import type { TipoFluxo } from '@/types/financial'

interface Props {
  open: boolean
  onClose: () => void
  imovelId: string
  defasagemIncc: number
  mesesReferencia?: number
  onSaved: () => void
}

const TIPOS: { valor: TipoFluxo; label: string }[] = [
  { valor: 'entrada', label: 'Entrada' },
  { valor: 'sinal', label: 'Sinal' },
  { valor: 'anual', label: 'Anual' },
  { valor: 'mensal', label: 'Mensal' },
  { valor: 'financiamento', label: 'Financiamento' },
]

export const FluxoDialog: React.FC<Props> = ({
  open,
  onClose,
  imovelId,
  defasagemIncc,
  mesesReferencia,
  onSaved,
}) => {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<TipoFluxo>('mensal')
  const [parcelas, setParcelas] = useState(1)
  const [valor, setValor] = useState('')
  const [primeiro, setPrimeiro] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  if (!open) return null

  const salvar = async () => {
    if (!nome.trim()) return setErro('Informe o nome do fluxo')
    if (!valor || Number(valor) <= 0) return setErro('Informe o valor da parcela')
    if (!primeiro) return setErro('Informe o primeiro vencimento')
    setSaving(true)
    setErro('')
    try {
      await imoveisService.criarFluxo({
        imovelId,
        nome: nome.trim(),
        tipo,
        parcelas: Math.max(1, parcelas),
        valorParcela: Number(valor),
        primeiroVencimento: primeiro,
        defasagemIncc,
        mesesReferencia,
      })
      setNome('')
      setValor('')
      setPrimeiro('')
      setParcelas(1)
      onSaved()
      onClose()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar fluxo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1F1235]">Novo fluxo</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Nome do fluxo *</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Entrada, Sinal, Mensais…"
              className="w-full mt-1 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm outline-none focus:border-[#6639A6]"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Tipo *</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {TIPOS.map((t) => (
                <button
                  key={t.valor}
                  onClick={() => setTipo(t.valor)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    tipo === t.valor
                      ? 'bg-[#6639A6] text-white border-[#6639A6]'
                      : 'bg-white text-gray-600 border-[#ECE6F2]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600">
                Quantidade de parcelas *
              </label>
              <input
                type="number"
                min={1}
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className="w-full mt-1 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm outline-none focus:border-[#6639A6]"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Valor da parcela (R$) *</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full mt-1 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm outline-none focus:border-[#6639A6]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600">Primeiro vencimento *</label>
            <input
              type="date"
              value={primeiro}
              onChange={(e) => setPrimeiro(e.target.value)}
              className="w-full mt-1 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm outline-none focus:border-[#6639A6]"
            />
          </div>

          <p className="text-[11px] text-gray-400">
            Cada parcela usa o INCC do mês{' '}
            {mesesReferencia === 0
              ? 'do próprio vencimento'
              : `${mesesReferencia} ${mesesReferencia === 1 ? 'mês' : 'meses'} antes do vencimento`}{' '}
            (configurável no card "Correção pelo INCC"), aplicado × {defasagemIncc} mês(es) de
            carrego desde a assinatura do contrato. Índices ainda não divulgados são estimados pela
            média do INCC do ano corrente.
          </p>

          {erro && <p className="text-xs text-red-500">{erro}</p>}

          <button
            onClick={() => void salvar()}
            disabled={saving}
            className="w-full mt-2 bg-[#6639A6] hover:bg-[#4A247A] disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {saving ? 'Salvando…' : 'Salvar fluxo'}
          </button>
        </div>
      </div>
    </div>
  )
}
