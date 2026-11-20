import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Home, CheckCircle2, Clock, Building2, Lock } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { useAuth } from '@/context/AuthContext'
import { imoveisService } from '@/services/imoveis'
import { calcularImovel, type IndiceINCC } from '@/lib/incc'
import { formatBRLPublic } from '@/lib/format'
import type { Imovel, FluxoImovel, ParcelaFluxo } from '@/types/financial'
import { NovoImovelDialog } from './NovoImovelDialog'

export const ImoveisLista: React.FC = () => {
  const navigate = useNavigate()
  const { canAccessImoveis } = useAuth()
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [fluxos, setFluxos] = useState<Record<string, FluxoImovel[]>>({})
  const [parcelas, setParcelas] = useState<Record<string, ParcelaFluxo[]>>({})
  const [indices, setIndices] = useState<IndiceINCC>({})
  const [loading, setLoading] = useState(true)
  const [showNovo, setShowNovo] = useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const lista = await imoveisService.list()
      setImoveis(lista)

      const idx = await imoveisService.listarIndicesINCC()
      setIndices(idx)

      const fluxosMap: Record<string, FluxoImovel[]> = {}
      const parcelasMap: Record<string, ParcelaFluxo[]> = {}
      for (const imv of lista) {
        const fl = await imoveisService.listarFluxos(imv.id)
        fluxosMap[imv.id] = fl
        const ps = await imoveisService.listarParcelas(fl.map((f) => f.id))
        parcelasMap[imv.id] = ps
      }
      setFluxos(fluxosMap)
      setParcelas(parcelasMap)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canAccessImoveis) void load()
    else setLoading(false)
  }, [canAccessImoveis, load])

  const calculos = useMemo(() => {
    return imoveis.map((imv) =>
      calcularImovel(imv, fluxos[imv.id] || [], parcelas[imv.id] || [], indices),
    )
  }, [imoveis, fluxos, parcelas, indices])

  const saldoTotal = calculos.reduce((s, c) => s + c.saldoCorrigido, 0)
  const totalPago = calculos.reduce((s, c) => s + c.totalPago, 0)
  const parcelasAtrasadas = calculos.reduce(
    (s, c) =>
      s +
      c.fluxos
        .flatMap((f) => f.parcelas)
        .filter((p) => {
          if (p.parcela.pago) return false
          const venc = new Date(p.parcela.vencimento)
          const hoje = new Date()
          return venc < new Date(hoje.getFullYear(), hoje.getMonth(), 1)
        }).length,
    0,
  )

  if (!canAccessImoveis) {
    return (
      <div className="min-h-screen bg-[#F5F3F7] pb-24">
        <AppHeader />
        <div className="max-w-md mx-auto px-4 pt-6 text-center">
          <Lock className="w-12 h-12 text-[#6639A6] mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[#1F1235]">Imóveis</h1>
          <p className="text-sm text-gray-500 mt-2">
            A seção de Imóveis é exclusiva do plano Premium.
          </p>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F3F7] pb-24">
      <AppHeader />

      <div className="max-w-md mx-auto px-4 pt-4">
        {/* Header da seção */}
        <div className="flex items-start justify-between mb-1">
          <h1 className="text-2xl font-bold text-[#1F1235]">Imóveis</h1>
          <button
            onClick={() => setShowNovo(true)}
            className="flex items-center gap-1.5 bg-[#6639A6] hover:bg-[#4A247A] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo imóvel
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Fluxo de pagamento, parcelas e correção pelo INCC
        </p>

        {/* Cartão roxo grande */}
        <div className="rounded-3xl bg-gradient-to-br from-[#7C3AED] to-[#6639A6] text-white p-5 shadow-lg mb-6">
          <p className="text-sm text-white/80 mb-1">Saldo a pagar (corrigido)</p>
          <p className="text-4xl font-extrabold tracking-tight mb-4">
            {formatBRLPublic(saldoTotal)}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                <span className="text-xs text-white/80">Já pago</span>
              </div>
              <p className="text-lg font-bold mt-1">{formatBRLPublic(totalPago)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-rose-300" />
                <span className="text-xs text-white/80">Em dia</span>
              </div>
              <p className="text-lg font-bold mt-1">
                {parcelasAtrasadas === 0 ? '0' : `${parcelasAtrasadas} atrasada(s)`}
              </p>
            </div>
          </div>
        </div>

        {/* Meus imóveis */}
        <h2 className="text-lg font-bold text-[#1F1235] mb-3">Meus imóveis</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/70 animate-pulse" />
            ))}
          </div>
        ) : calculos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm">Nenhum imóvel cadastrado ainda.</p>
            <p className="text-sm">Toque em "Novo imóvel" para começar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {calculos.map((calc) => {
              const pct =
                calc.totalParcelas > 0
                  ? Math.round((calc.parcelasPagas / calc.totalParcelas) * 100)
                  : 0
              return (
                <button
                  key={calc.imovel.id}
                  onClick={() => navigate(`/imoveis/${calc.imovel.id}`)}
                  className="w-full text-left bg-white rounded-2xl p-4 shadow-sm border border-[#ECE6F2] active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#6639A6]/10 flex items-center justify-center shrink-0">
                      <Home className="w-5 h-5 text-[#6639A6]" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-[#1F1235] truncate">{calc.imovel.nome}</p>
                      <p className="text-xs text-gray-500">{calc.imovel.construtora}</p>
                    </div>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-[#ECE6F2] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#7C3AED] to-[#6639A6] rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Pago{' '}
                      <span className="font-bold text-[#1F1235]">
                        {formatBRLPublic(calc.totalPago)}
                      </span>
                    </span>
                    <span className="text-gray-500">
                      Restantes{' '}
                      <span className="font-bold text-[#1F1235]">
                        {formatBRLPublic(calc.totalRestante)}
                      </span>
                    </span>
                  </div>

                  {calc.proxima && (
                    <div className="mt-2 pt-2 border-t border-[#ECE6F2] flex items-center gap-1.5 text-xs text-gray-600">
                      <span className="font-semibold text-[#6639A6]">Próxima:</span>
                      {new Date(calc.proxima.parcela.vencimento).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}{' '}
                      · {formatBRLPublic(calc.proxima.valorCorrigido)}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <NovoImovelDialog
        open={showNovo}
        onClose={() => setShowNovo(false)}
        onSaved={() => void load()}
      />

      <BottomNav />
    </div>
  )
}
