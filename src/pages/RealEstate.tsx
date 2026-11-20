import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { imoveisService } from '@/services/imoveis'
import { useAuth } from '@/context/AuthContext'
import type { Imovel, ImovelCalculoINCC } from '@/types/financial'
import {
  Building2,
  Lock,
  Sparkles,
  TrendingUp,
  RefreshCw,
  Plus,
  Trash2,
  Calendar,
  Layers,
  HelpCircle,
  ExternalLink,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export const RealEstatePage: React.FC = () => {
  const { plan, canAccessImoveis } = useAuth()
  const [imoveis, setImoveis] = useState<Imovel[]>([])
  const [calculos, setCalculos] = useState<Record<string, ImovelCalculoINCC>>({})
  const [loading, setLoading] = useState(true)
  const [syncingBcb, setSyncingBcb] = useState(false)

  // Modal para adicionar imóvel
  const [modalOpen, setModalOpen] = useState(false)
  const [nome, setNome] = useState('')
  const [construtora, setConstrutora] = useState('')
  const [valorStr, setValorStr] = useState('')
  const [mesBase, setMesBase] = useState('2024-01')
  const [defasagem, setDefasagem] = useState(2)
  const [dataEntrega, setDataEntrega] = useState('')

  const loadImoveis = async () => {
    if (!canAccessImoveis) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const list = await imoveisService.list()
      setImoveis(list)

      // Calcula a correção INCC para cada imóvel cadastrado
      const calcMap: Record<string, ImovelCalculoINCC> = {}
      for (const imovel of list) {
        try {
          const res = await imoveisService.calcularINCC(
            imovel.valor_original,
            imovel.mes_base_incc,
            imovel.defasagem_meses || 2,
          )
          calcMap[imovel.id] = res
        } catch (e) {
          console.error('Erro ao calcular INCC do imóvel:', e)
        }
      }
      setCalculos(calcMap)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar imóveis',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadImoveis()
  }, [canAccessImoveis])

  const handleSyncBCB = async () => {
    setSyncingBcb(true)
    try {
      const res = await imoveisService.syncINCCWithBCB()
      toast({
        title: 'INCC Sincronizado!',
        description: res.message || 'Dados atualizados da API SGS 192 do Banco Central.',
      })
      await loadImoveis()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Falha na sincronização',
        description: 'Não foi possível consultar a API do Banco Central no momento.',
      })
    } finally {
      setSyncingBcb(false)
    }
  }

  const handleCreateImovel = async (e: React.FormEvent) => {
    e.preventDefault()
    const valorNum = parseFloat(valorStr.replace(/\./g, '').replace(',', '.'))
    if (!nome.trim() || !valorNum || valorNum <= 0) {
      toast({ variant: 'destructive', title: 'Preencha nome e valor do contrato' })
      return
    }

    try {
      const created = await imoveisService.create({
        nome,
        construtora,
        valor_original: valorNum,
        mes_base_incc: mesBase,
        defasagem_meses: defasagem,
        data_entrega: dataEntrega || undefined,
      })
      setImoveis((prev) => [created, ...prev])
      setModalOpen(false)
      toast({ title: 'Imóvel cadastrado com sucesso!' })
      loadImoveis()
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao cadastrar imóvel' })
    }
  }

  const handleDelete = async (id: string, nomeImovel: string) => {
    if (!confirm(`Deseja realmente remover o imóvel "${nomeImovel}"?`)) return
    try {
      await imoveisService.delete(id)
      setImoveis((prev) => prev.filter((i) => i.id !== id))
      toast({ title: 'Imóvel removido' })
    } catch {
      toast({ variant: 'destructive', title: 'Erro ao remover' })
    }
  }

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-black text-[#1F1438] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#6639A6]" />
              Acompanhamento de Imóveis
            </h1>
            <p className="text-xs text-gray-500">
              Correção acumulada pelo INCC direto do Banco Central
            </p>
          </div>

          {canAccessImoveis && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSyncBCB}
                disabled={syncingBcb}
                title="Sincronizar índice com Banco Central"
                className="p-2 rounded-xl bg-white border border-[#EBE4F5] text-purple-700 hover:bg-purple-50 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingBcb ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-2xl bg-[#6639A6] text-white text-xs font-bold hover:bg-[#522c8a] transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo
              </button>
            </div>
          )}
        </div>

        {/* Bloqueio caso não seja Premium */}
        {!canAccessImoveis ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-amber-200 shadow-md">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-7 h-7" />
            </div>
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-black uppercase mb-2">
              Recurso Exclusivo Premium
            </span>
            <h3 className="text-base font-black text-[#1F1438]">
              Acompanhamento & Correção pelo INCC
            </h3>
            <p className="text-xs text-gray-600 mt-2 max-w-xs mx-auto">
              Apenas assinantes <strong>Premium</strong> têm acesso ao módulo de Imóveis na planta,
              que calcula o valor corrigido de acordo com a série oficial SGS 192 do Banco Central
              do Brasil.
            </p>

            <Link
              to="/planos"
              className="inline-flex items-center gap-2 mt-5 px-6 py-2.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white text-xs font-black shadow-md hover:opacity-95 transition"
            >
              <Sparkles className="w-4 h-4 text-white" />
              Conhecer o Plano Premium
            </Link>
          </div>
        ) : (
          /* Módulo Liberado para Usuários Premium */
          <>
            {/* Card Explicativo da Fonte Oficial BCB */}
            <div className="bg-gradient-to-r from-[#2A1548] to-[#4A247A] text-white rounded-3xl p-4 shadow-sm border border-purple-300/30 flex items-start gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-amber-300" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-white flex items-center gap-1.5">
                  Índice Oficial: INCC / FGV (Série SGS 192)
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full border border-emerald-400/30">
                    Ao Vivo BCB
                  </span>
                </p>
                <p className="text-white/70 text-[11px] mt-0.5">
                  A correção é calculada pelo produto acumulado das variações mensais desde o
                  mês-base contratual até o mês de referência (com defasagem configurada).
                </p>
              </div>
            </div>

            {/* Lista de Imóveis Cadastrados */}
            <div className="space-y-3">
              {loading ? (
                <div className="py-12 text-center text-xs text-gray-400">
                  <span className="inline-block w-5 h-5 border-2 border-[#6639A6] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : imoveis.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 text-center text-xs text-gray-400 border border-gray-100">
                  Nenhum imóvel cadastrado. Clique em &quot;Novo&quot; para adicionar seu
                  apartamento ou casa na planta.
                </div>
              ) : (
                imoveis.map((imovel) => {
                  const calc = calculos[imovel.id]
                  return (
                    <div
                      key={imovel.id}
                      className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.06)] border border-[#EBE4F5] space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-black text-gray-900 leading-tight">
                            {imovel.nome}
                          </h3>
                          {imovel.construtora && (
                            <p className="text-[11px] text-gray-500 mt-0.5">{imovel.construtora}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDelete(imovel.id, imovel.nome)}
                          className="p-1.5 text-gray-400 hover:text-rose-500 rounded-lg transition"
                          title="Excluir imóvel"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Parâmetros Contratuais */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-2xl bg-gray-50 border border-gray-100">
                          <span className="text-[10px] text-gray-500 block uppercase font-bold">
                            Mês-Base INCC
                          </span>
                          <span className="font-bold text-gray-800">{imovel.mes_base_incc}</span>
                        </div>

                        <div className="p-2.5 rounded-2xl bg-gray-50 border border-gray-100">
                          <span className="text-[10px] text-gray-500 block uppercase font-bold">
                            Defasagem
                          </span>
                          <span className="font-bold text-gray-800">
                            {imovel.defasagem_meses ?? 2} meses
                          </span>
                        </div>
                      </div>

                      {/* Comparativo: Original vs Corrigido */}
                      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50/80 to-purple-100/50 border border-purple-200/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 font-medium">
                            Valor Original (Contrato):
                          </span>
                          <span className="font-bold text-gray-800">
                            {formatBRL(imovel.valor_original)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 font-medium">
                            Correção INCC Acumulada:
                          </span>
                          <span className="font-bold text-emerald-700">
                            + {formatBRL(calc?.correcaoAcumulada || 0)} (
                            {calc?.percentualAcumulado ? calc.percentualAcumulado.toFixed(2) : '0'}
                            %)
                          </span>
                        </div>

                        <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between">
                          <span className="text-xs font-black text-[#1F1438]">
                            Valor Atual Corrigido:
                          </span>
                          <span className="text-base font-black text-[#6639A6]">
                            {formatBRL(calc?.valorCorrigido || imovel.valor_original)}
                          </span>
                        </div>
                      </div>

                      {/* Histórico resumido de aplicação */}
                      {calc?.historico && calc.historico.length > 0 && (
                        <div className="pt-1">
                          <p className="text-[11px] font-bold text-gray-500 mb-1">
                            Variações aplicadas do BCB ({calc.historico.length} meses):
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {calc.historico.slice(-6).map((h, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100/60 text-[#4A247A] font-semibold"
                              >
                                {h.mes}: +{h.variacao.toFixed(2)}%
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* Modal de Cadastro de Imóvel */}
        {modalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-3.5">
              <h2 className="text-base font-black text-[#1F1438]">Cadastrar Imóvel na Planta</h2>

              <form onSubmit={handleCreateImovel} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nome / Unidade
                  </label>
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Apto 1204 - Residencial Bloom"
                    required
                    className="w-full h-10 px-3 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:border-[#6639A6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Construtora / Incorporadora
                  </label>
                  <input
                    type="text"
                    value={construtora}
                    onChange={(e) => setConstrutora(e.target.value)}
                    placeholder="Ex: Even Construtora"
                    className="w-full h-10 px-3 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:border-[#6639A6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Valor Original do Contrato (R$)
                  </label>
                  <input
                    type="text"
                    value={valorStr}
                    onChange={(e) => setValorStr(e.target.value)}
                    placeholder="Ex: 580.000,00"
                    required
                    className="w-full h-10 px-3 rounded-2xl border border-gray-200 text-xs font-bold focus:outline-none focus:border-[#6639A6]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Mês-Base INCC
                    </label>
                    <input
                      type="text"
                      value={mesBase}
                      onChange={(e) => setMesBase(e.target.value)}
                      placeholder="YYYY-MM (ex: 2024-01)"
                      required
                      className="w-full h-10 px-3 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:border-[#6639A6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Defasagem (meses)
                    </label>
                    <input
                      type="number"
                      value={defasagem}
                      onChange={(e) => setDefasagem(parseInt(e.target.value, 10) || 0)}
                      min="0"
                      max="12"
                      required
                      className="w-full h-10 px-3 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:border-[#6639A6]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Previsão de Entrega (Opcional)
                  </label>
                  <input
                    type="date"
                    value={dataEntrega}
                    onChange={(e) => setDataEntrega(e.target.value)}
                    className="w-full h-10 px-3 rounded-2xl border border-gray-200 text-xs focus:outline-none focus:border-[#6639A6]"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2 text-xs font-semibold text-gray-600 rounded-2xl bg-gray-100 hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-bold text-white rounded-2xl bg-[#6639A6] hover:bg-[#522c8a] shadow-md"
                  >
                    Salvar Imóvel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
