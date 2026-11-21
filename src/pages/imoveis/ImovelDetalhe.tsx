import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Landmark,
  Key,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Info,
} from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { useToast } from '@/hooks/use-toast'
import { imoveisService } from '@/services/imoveis'
import {
  calcularImovel,
  mesBaseContrato,
  rotuloMes,
  TRAVA_INCC_MESES,
  type IndiceINCC,
  type FluxoCalculado,
  type ParcelaCalculada,
} from '@/lib/incc'
import { formatBRLPublic } from '@/lib/format'
import type { Imovel, TipoFluxo } from '@/types/financial'
import { FluxoDialog } from './FluxoDialog'

const REF_MESES = [
  'Referência: 2 meses antes do vencimento',
  'Referência: 1 mês antes do vencimento',
  'Referência: 3 meses antes do vencimento',
  'Referência: no próprio vencimento',
]

export const ImovelDetalhe: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [imovel, setImovel] = useState<Imovel | null>(null)
  const [indices, setIndices] = useState<IndiceINCC>({})
  const [fluxosCalc, setFluxosCalc] = useState<ReturnType<typeof calcularImovel> | null>(null)
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({})
  const [showFluxo, setShowFluxo] = useState(false)
  const [mesBase, setMesBase] = useState('')
  const [defasagem, setDefasagem] = useState(2)
  const [savingCorrecao, setSavingCorrecao] = useState(false)

  const load = React.useCallback(async () => {
    if (!id) return
    const imv = await imoveisService.get(id)
    setImovel(imv)
    setMesBase(imv.mes_base_incc)
    setDefasagem(imv.defasagem_incc ?? imv.defasagem_meses ?? 2)
    const idx = await imoveisService.listarIndicesINCC()
    setIndices(idx)
    const fl = await imoveisService.listarFluxos(imv.id)
    const ps = await imoveisService.listarParcelas(fl.map((f) => f.id))
    setFluxosCalc(calcularImovel(imv, fl, ps, idx))
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const pctPagas = useMemo(() => {
    if (!fluxosCalc || fluxosCalc.totalParcelas === 0) return 0
    return Math.round((fluxosCalc.parcelasPagas / fluxosCalc.totalParcelas) * 100)
  }, [fluxosCalc])

  if (!imovel) {
    return (
      <div className="min-h-screen bg-[#F5F3F7] pb-24">
        <AppHeader />
        <div className="max-w-md mx-auto px-4 pt-10 text-center text-gray-500">Carregando…</div>
      </div>
    )
  }

  const salvarCorrecao = async () => {
    setSavingCorrecao(true)
    try {
      await imoveisService.update(imovel.id, {
        mes_base_incc: mesBase,
        defasagem_incc: defasagem,
        defasagem_meses: defasagem,
      })
      toast({ title: 'Correção salva' })
      await load()
    } catch {
      toast({ title: 'Erro ao salvar correção', variant: 'destructive' })
    } finally {
      setSavingCorrecao(false)
    }
  }

  const pagar = async (p: ParcelaCalculada) => {
    try {
      await imoveisService.pagarParcela(p.parcela.id, true)
      await load()
      toast({ title: 'Parcela marcada como paga' })
    } catch {
      toast({ title: 'Erro ao marcar parcela', variant: 'destructive' })
    }
  }

  const removerFluxo = async (fluxoId: string) => {
    try {
      await imoveisService.excluirFluxo(fluxoId)
      await load()
      toast({ title: 'Fluxo removido' })
    } catch {
      toast({ title: 'Erro ao remover fluxo', variant: 'destructive' })
    }
  }

  const refLabel =
    REF_MESES[TRAVA_INCC_MESES] || `Referência: ${TRAVA_INCC_MESES} meses antes do vencimento`
  const assinatura = mesBaseContrato(imovel)
  const exemploParcela = fluxosCalc?.fluxos.flatMap((f) => f.parcelas)[0]

  return (
    <div className="min-h-screen bg-[#F5F3F7] pb-24">
      <AppHeader />

      <div className="max-w-md mx-auto px-4 pt-3">
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => navigate('/imoveis')}
            className="p-1.5 rounded-full hover:bg-white"
          >
            <ArrowLeft className="w-5 h-5 text-[#1F1235]" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-[#1F1235] truncate">{imovel.nome}</h1>
            <p className="text-xs text-gray-500 truncate">
              {imovel.construtora}
              {imovel.data_contrato &&
                ` · Contrato de ${new Date(imovel.data_contrato).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}`}
            </p>
          </div>
        </div>

        {/* Cartão roxo */}
        <div className="rounded-3xl bg-gradient-to-br from-[#7C3AED] to-[#6639A6] text-white p-5 shadow-lg mb-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm text-white/80">
              {fluxosCalc?.parcelasPagas ?? 0} de {fluxosCalc?.totalParcelas ?? 0} parcelas pagas
            </p>
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">
              {pctPagas}%
            </span>
          </div>
          <p className="text-sm text-white/80 mb-1">Saldo a pagar (corrigido pelo INCC)</p>
          <p className="text-4xl font-extrabold tracking-tight mb-4">
            {formatBRLPublic(fluxosCalc?.saldoCorrigido ?? 0)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span className="text-xs text-white/80">Já pago</span>
              </div>
              <p className="text-lg font-bold mt-1">
                {formatBRLPublic(fluxosCalc?.totalPago ?? 0)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-emerald-300" />
                <span className="text-xs text-white/80">A financiar</span>
              </div>
              <p className="text-lg font-bold mt-1">
                {formatBRLPublic(
                  fluxosCalc?.fluxos
                    .filter((f) => f.fluxo.tipo === 'financiamento')
                    .reduce((s, f) => s + f.totalRestante, 0) ?? 0,
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-2 mb-3">
          {imovel.data_chaves && (
            <span className="inline-flex items-center gap-1 text-xs bg-white border border-[#ECE6F2] rounded-full px-3 py-1 text-gray-600">
              <Key className="w-3 h-3 text-[#6639A6]" />
              Chaves:{' '}
              {new Date(imovel.data_chaves).toLocaleDateString('pt-BR', {
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
          )}
          {imovel.data_financiamento && (
            <span className="inline-flex items-center gap-1 text-xs bg-white border border-[#ECE6F2] rounded-full px-3 py-1 text-gray-600">
              <Landmark className="w-3 h-3 text-[#6639A6]" />
              Financiamento:{' '}
              {new Date(imovel.data_financiamento).toLocaleDateString('pt-BR', {
                month: '2-digit',
                year: 'numeric',
              })}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs bg-white border border-[#ECE6F2] rounded-full px-3 py-1 text-gray-600">
            <TrendingUp className="w-3 h-3 text-[#6639A6]" />
            Último INCC: {rotuloMes(Object.keys(indices).sort().pop() || mesBase)}
          </span>
        </div>

        {/* Correção pelo INCC */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#ECE6F2] mb-4">
          <h2 className="font-bold text-[#1F1235] mb-3">Correção pelo INCC</h2>
          <div className="rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm mb-2">
            {refLabel}
          </div>
          <p className="text-xs text-gray-500 mb-3 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#6639A6]" />
            {exemploParcela
              ? `Parcela de ${rotuloMes(exemploParcela.mesVenc)} usa o INCC de ${rotuloMes(exemploParcela.mesReferencia)} (trava: 2 meses antes do vencimento), aplicado × ${exemploParcela.mesesCarrego} ${exemploParcela.mesesCarrego === 1 ? 'mês' : 'meses'} de carrego desde ${rotuloMes(assinatura)}.`
              : 'Cada parcela usa o INCC do mês 2 meses antes do seu vencimento, multiplicado pelos meses de carrego desde a assinatura do contrato.'}
          </p>
          <label className="text-xs font-semibold text-gray-600">Mês-base do contrato *</label>
          <input
            type="month"
            value={mesBase}
            onChange={(e) => setMesBase(e.target.value)}
            className="w-full mt-1 mb-3 rounded-xl border border-[#ECE6F2] bg-[#FAF8FC] px-3 py-2.5 text-sm outline-none focus:border-[#6639A6]"
          />
          <button
            onClick={() => void salvarCorrecao()}
            disabled={savingCorrecao}
            className="w-full bg-[#6639A6]/20 hover:bg-[#6639A6]/30 text-[#6639A6] font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
          >
            {savingCorrecao ? 'Salvando…' : 'Salvar correção'}
          </button>
        </div>

        {/* Fluxo de pagamento */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-[#1F1235]">Fluxo de pagamento</h2>
          <button
            onClick={() => setShowFluxo(true)}
            className="text-sm font-semibold text-[#6639A6] inline-flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Fluxo
          </button>
        </div>

        {fluxosCalc && fluxosCalc.fluxos.length === 0 && (
          <div className="text-center text-sm text-gray-500 py-6">
            Nenhum fluxo cadastrado. Toque em "+ Fluxo" para criar o primeiro.
          </div>
        )}

        <div className="space-y-3">
          {fluxosCalc?.fluxos.map((fc) => (
            <FluxoCard
              key={fc.fluxo.id}
              fc={fc}
              aberto={!!expandidos[fc.fluxo.id]}
              onToggle={() =>
                setExpandidos((prev) => ({ ...prev, [fc.fluxo.id]: !prev[fc.fluxo.id] }))
              }
              onPagar={(p) => void pagar(p)}
              onRemover={() => void removerFluxo(fc.fluxo.id)}
            />
          ))}
        </div>

        {fluxosCalc?.estimado && (
          <p className="text-xs text-gray-500 mt-4 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
            Valores marcados como "Estimado" usam a média do INCC de {new Date().getFullYear()} como
            aproximação e viram definitivos automaticamente quando o INCC real do mês de referência
            (2 meses antes do vencimento) é divulgado.
          </p>
        )}
      </div>

      <FluxoDialog
        open={showFluxo}
        onClose={() => setShowFluxo(false)}
        imovelId={imovel.id}
        defasagemIncc={defasagem}
        onSaved={() => void load()}
      />

      <BottomNav />
    </div>
  )
}

const FluxoCard: React.FC<{
  fc: FluxoCalculado
  aberto: boolean
  onToggle: () => void
  onPagar: (p: ParcelaCalculada) => void
  onRemover: () => void
}> = ({ fc, aberto, onToggle, onPagar, onRemover }) => {
  const restante = fc.totalRestante
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#ECE6F2] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-4 flex items-center justify-between gap-2"
      >
        <div>
          <p className="font-bold text-[#1F1235]">{fc.fluxo.nome}</p>
          <p className="text-xs text-gray-500">
            {fc.qtdePaga}/{fc.parcelas.length} pagas · corrigido pelo INCC
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="font-bold text-[#1F1235] text-sm">{formatBRLPublic(restante)}</p>
            <p className="text-xs text-gray-500">restante</p>
          </div>
          {aberto ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {aberto && (
        <div className="px-4 pb-4 border-t border-[#ECE6F2] pt-3 space-y-3">
          {fc.parcelas.map((p) => {
            const venc = new Date(p.parcela.vencimento)
            return (
              <div key={p.parcela.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#1F1235]">
                    {p.parcela.numero}/{fc.parcelas.length} ·{' '}
                    {venc.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-gray-500">
                    Base {formatBRLPublic(p.valorBase)}
                    {p.mesesCarrego > 0 &&
                      p.taxaReferencia &&
                      ` · INCC ${rotuloMes(p.taxaReferencia.mes)}: ${p.taxaUsada.toFixed(2)}% × ${p.mesesCarrego} ${p.mesesCarrego === 1 ? 'mês' : 'meses'} = ${((p.fator - 1) * 100).toFixed(2)}% (${formatBRLPublic(p.correcao)})`}
                  </p>
                  {p.estimado && (
                    <p className="text-[11px] text-amber-600 bg-amber-50 inline-block px-2 py-0.5 rounded-full mt-1">
                      Estimado · INCC de {rotuloMes(p.mesReferencia)} ainda não divulgado · média{' '}
                      {p.taxaUsada.toFixed(2)}%/mês (valor aproximado)
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                  <p
                    className={`font-bold text-sm ${p.parcela.pago ? 'text-emerald-600 line-through' : 'text-[#1F1235]'}`}
                  >
                    {formatBRLPublic(p.valorCorrigido)}
                  </p>
                  {!p.parcela.pago && (
                    <button
                      onClick={() => onPagar(p)}
                      className="text-xs font-semibold bg-[#6639A6] text-white px-4 py-1.5 rounded-lg hover:bg-[#4A247A]"
                    >
                      Pagar
                    </button>
                  )}
                  {p.parcela.pago && (
                    <span className="text-[11px] text-emerald-600 font-semibold">Pago</span>
                  )}
                </div>
              </div>
            )
          })}
          <button
            onClick={onRemover}
            className="text-xs font-semibold text-red-500 hover:text-red-600"
          >
            Remover fluxo
          </button>
        </div>
      )}
    </div>
  )
}

export type { TipoFluxo }
