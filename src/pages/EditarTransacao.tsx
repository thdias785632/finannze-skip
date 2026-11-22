import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { LogoLoader } from '@/components/LogoLoader'
import { cartoesService } from '@/services/cartoes'
import { categoriasService } from '@/services/categorias'
import { transacoesService, mesDaFatura, descricaoBase, rotuloFatura } from '@/services/transacoes'
import type { Cartao, Categoria, Transacao } from '@/types/financial'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { DivisaoGrupo, validarDivisao, type DivisaoMembro } from '@/components/DivisaoGrupo'
import { ArrowLeft, CreditCard, TrendingUp } from 'lucide-react'

type DadosEdicao = {
  descricao: string
  valor: number
  data: string // YYYY-MM-DD
  cartao_id: string // '' para entradas
  categoria_id: string
  recorrente: boolean
  parcelas: number // 1 quando não é de cartão
}

/**
 * Edição de uma movimentação EXISTENTE — despesa de cartão, despesa normal
 * (sem cartão) ou entrada. Abre o formulário já preenchido com os dados
 * atuais e salva com update() sobre o registro (nunca cria outro lançamento).
 *
 * Quando a movimentação pertence a uma série de parcelas, salvar é APAGAR-
 * AND-RECRIAR: todas as parcelas da série (pagas ou não) são excluídas do
 * banco e a série volta do zero com o que está no formulário — novo valor,
 * nova data de início e novo número de parcelas, via recriarSerie().
 */
export const EditarTransacaoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()

  // Tela de onde a edição foi aberta (Cartões, Extrato…): volta para ela ao salvar.
  const stateFrom = (location.state as { from?: string } | null)?.from
  const paginaOrigem: string = typeof stateFrom === 'string' ? stateFrom : '/cartoes'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const [transacao, setTransacao] = useState<Transacao | null>(null)
  const [cartoes, setCartoes] = useState<Cartao[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])

  const [cartaoId, setCartaoId] = useState('')
  const [dataReferencia, setDataReferencia] = useState('')
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [parcelas, setParcelas] = useState('1')
  const [recorrente, setRecorrente] = useState<'sim' | 'nao'>('nao')
  const { canAccessRecurring } = useAuth()
  const [divisao, setDivisao] = useState<DivisaoMembro[]>([])

  // Série: posição da parcela e tamanho atual da série (só para o aviso).
  const [parcelaNumero, setParcelaNumero] = useState(0)
  const [parcelaTotal, setParcelaTotal] = useState(0)

  useEffect(() => {
    const load = async () => {
      if (!id) {
        setNotFound(true)
        setLoading(false)
        return
      }
      try {
        const [t, cs, cats] = await Promise.all([
          transacoesService.get(id),
          cartoesService.list(),
          categoriasService.list(),
        ])
        setTransacao(t)
        setCartoes(cs)
        setCategorias(cats)
        setCartaoId(t.cartao_id || '')
        setDataReferencia(String(t.data).slice(0, 10))
        // Nome SEM o sufixo "(k/n)" — a renumeração vem do campo Parcelas.
        setNome(descricaoBase(t.descricao) || t.descricao)
        setValor(String(t.valor))
        setCategoriaId(t.categoria_id || '')
        setParcelas(String(t.parcela_total && t.parcela_total > 1 ? t.parcela_total : 1))
        setRecorrente(t.recorrente ? 'sim' : 'nao')
        setParcelaNumero(t.parcela_numero ?? 0)
        setParcelaTotal(t.parcela_total ?? 0)
        // Divisão já gravada (a da parcela serve para a série inteira).
        const divs = await transacoesService.listarDivisoes(t.id).catch(() => [])
        setDivisao(divs.map((d) => ({ user_id: d.user_id, valor: Number(d.valor) })))
      } catch (err) {
        console.error(err)
        setNotFound(true)
        toast({ variant: 'destructive', title: 'Erro ao carregar a movimentação' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const ehEntrada = transacao?.tipo === 'receita'

  const categoriasAplicaveis = categorias.filter((c) => {
    if (c.id === categoriaId) return true
    if (ehEntrada) return c.tipo === 'receita' || c.tipo === 'ambos'
    return c.tipo === 'despesa' || c.tipo === 'ambos'
  })

  const cartaoSelecionado = cartoes.find((c) => c.id === cartaoId)

  // Prévia da fatura após a edição, com a regra do vencimento (mesDaFatura):
  // gasto no dia do vencimento ou depois cai na fatura do mês seguinte.
  const faturaPrevista = transacao
    ? mesDaFatura(
        { ...transacao, data: dataReferencia, cartao_id: cartaoId || undefined },
        cartaoSelecionado ? [cartaoSelecionado] : cartoes,
      )
    : null

  // Número de parcelas efetivo: no cartão, o campo editável (1-24). Fora do
  // cartão (outras despesas e entradas) não há parcelas.
  const ehParcelado = !ehEntrada && Boolean(cartaoId)
  const numParcelas = Math.max(1, Math.min(24, Number(parcelas) || 1))

  const salvar = async (dados: DadosEdicao) => {
    if (!transacao) return
    setSaving(true)
    try {
      if (ehEntrada) {
        // Entrada: sem cartão (a relação é zerada) e sem parcelas.
        await transacoesService.update(transacao.id, {
          descricao: dados.descricao,
          valor: dados.valor,
          tipo: 'receita',
          data: dados.data,
          cartao_id: null,
          categoria_id: dados.categoria_id,
          recorrente: dados.recorrente,
        })
        // Divisão do lançamento (a série não se aplica a entrada).
        await transacoesService.aplicarDivisao(transacao, divisao)
      } else if (transacao.serie_id || dados.parcelas > 1) {
        // Série: APAGAR-AND-RECRIAR, sem exceção e sem perguntar escopo —
        // TODAS as parcelas existentes (mesmo as já pagas) são excluídas do
        // banco e a série volta do zero com o novo valor, a nova data de
        // início, o novo número de parcelas, cartão, nome, categoria e
        // recorrente. Com 1 parcela, a série some e vira lançamento único.
        await transacoesService.recriarSerie(
          transacao,
          {
            descricao: dados.descricao,
            valor: dados.valor,
            data: dados.data,
            cartao_id: dados.cartao_id,
            categoria_id: dados.categoria_id,
            recorrente: dados.recorrente,
            parcelas: dados.parcelas,
          },
          divisao,
        )
      } else {
        // Lançamento único: update() sobre o registro, sem tocar na série de
        // ninguém (não há série).
        await transacoesService.update(transacao.id, {
          descricao: dados.descricao,
          valor: dados.valor,
          tipo: 'despesa',
          data: dados.data,
          cartao_id: dados.cartao_id || null,
          categoria_id: dados.categoria_id,
          recorrente: dados.recorrente,
        })
        // Divisão do lançamento único (gravada ou limpa).
        await transacoesService.aplicarDivisao(transacao, divisao)
      }

      toast({ title: 'Movimentação atualizada!' })
      navigate(paginaOrigem)
    } catch (err) {
      console.error(err)
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: 'Verifique os campos e tente novamente.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!transacao) return

    const valorNum = Number(valor.replace(',', '.'))
    if (!nome.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome da movimentação' })
      return
    }
    if (!valorNum || valorNum <= 0) {
      toast({ variant: 'destructive', title: 'Informe um valor válido' })
      return
    }
    // Despesa "outras" (sem cartão) é válida: cartão só é obrigatório quando a
    // transação editada JÁ tinha um (edição continua no mesmo modo).
    if (!ehEntrada && transacao.cartao_id && !cartaoId) {
      toast({ variant: 'destructive', title: 'Selecione o cartão' })
      return
    }
    if (!categoriaId) {
      toast({ variant: 'destructive', title: 'Selecione a categoria' })
      return
    }
    const erroDivisao = validarDivisao(valorNum, divisao)
    if (erroDivisao) {
      toast({ variant: 'destructive', title: erroDivisao })
      return
    }

    const dados: DadosEdicao = {
      descricao: nome.trim(),
      valor: valorNum,
      data: dataReferencia,
      cartao_id: ehEntrada ? '' : cartaoId,
      categoria_id: categoriaId,
      recorrente: canAccessRecurring && recorrente === 'sim',
      parcelas: ehParcelado ? numParcelas : 1,
    }
    await salvar(dados)
  }

  const inputCls =
    'w-full h-11 px-3 rounded-xl border border-gray-200 text-sm text-[#1F1438] bg-white focus:outline-none focus:ring-2 focus:ring-[#6639A6]/30 focus:border-[#6639A6]'
  const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-1'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F3FB] flex items-center justify-center">
        <LogoLoader size={56} />
      </div>
    )
  }

  if (notFound || !transacao) {
    return (
      <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
        <AppHeader />
        <main className="max-w-md mx-auto px-4 pt-10">
          <div className="bg-white rounded-3xl p-8 text-center border border-[#EBE4F5]">
            <p className="text-sm font-bold text-gray-700">Movimentação não encontrada</p>
            <p className="text-xs text-gray-500 mt-1">
              Ela pode ter sido excluída ou não está mais disponível.
            </p>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 px-5 py-2.5 rounded-xl bg-[#6639A6] text-white text-xs font-bold"
            >
              Voltar
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 pb-10">
        <div className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.08)] border border-[#EBE4F5]">
          {/* Cabeçalho do modo edição */}
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-1.5 rounded-full hover:bg-[#F1EAF9] transition"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4 text-[#6639A6]" />
            </button>
            <h1 className="text-sm font-black text-[#1F1438] flex items-center gap-1.5">
              {ehEntrada ? (
                <TrendingUp className="w-4 h-4 text-[#6639A6]" />
              ) : (
                <CreditCard className="w-4 h-4 text-[#6639A6]" />
              )}
              {ehEntrada ? 'Editar entrada' : 'Editar saída'}
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Cartão — só para despesas; entradas não têm cartão */}
            {!ehEntrada && (
              <div>
                <label className={labelCls}>
                  {transacao.cartao_id ? 'Selecione o Cartão*' : 'Cartão (opcional)'}
                </label>
                <select
                  value={cartaoId}
                  onChange={(e) => setCartaoId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Sem cartão (outra despesa)</option>
                  {cartoes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Data de Referência */}
            <div>
              <label className={labelCls}>Data de Referência*</label>
              <input
                type="date"
                value={dataReferencia}
                onChange={(e) => setDataReferencia(e.target.value)}
                className={inputCls}
                required
              />
            </div>

            {/* Nome */}
            <div>
              <label className={labelCls}>
                {ehEntrada ? 'Nome da entrada*' : 'Nome da saída*'}
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={inputCls}
                required
              />
            </div>

            {/* Valor */}
            <div>
              <label className={labelCls}>Valor*</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={inputCls}
                required
              />
            </div>

            {/* Categoria */}
            <div>
              <label className={labelCls}>Selecione a Categoria*</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className={inputCls}
                required
              >
                <option value="">Selecione a Categoria*</option>
                {categoriasAplicaveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Parcelas — só quando há cartão; editável também na série */}
            {ehParcelado && (
              <div>
                <label className={labelCls}>Parcelas</label>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  placeholder="Parcelas"
                  className={inputCls}
                />
                {numParcelas > 1 && Number(valor.replace(',', '.')) > 0 && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    {numParcelas}x de{' '}
                    <strong className="text-[#6639A6]">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(Number(valor.replace(',', '.')) / numParcelas)}
                    </strong>{' '}
                    — um lançamento por mês, conforme a fatura.
                  </p>
                )}
              </div>
            )}

            {/* Divisão entre membros do grupo */}
            <DivisaoGrupo
              valorTotal={Number(valor.replace(',', '.')) || 0}
              valor={divisao}
              onChange={setDivisao}
            />

            {/* Recorrente — exclusivo dos planos pagos (VIP/Premium) */}
            <div>
              <label className={labelCls}>Recorrente:</label>
              <div
                className={`flex items-center gap-6 pl-1 ${!canAccessRecurring ? 'opacity-50' : ''}`}
              >
                <label
                  className={`flex items-center gap-2 text-xs font-semibold text-gray-700 ${
                    canAccessRecurring ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                  title={!canAccessRecurring ? 'Recurso exclusivo do plano VIP' : undefined}
                >
                  <input
                    type="radio"
                    name="recorrente"
                    checked={recorrente === 'sim'}
                    onChange={() => canAccessRecurring && setRecorrente('sim')}
                    disabled={!canAccessRecurring}
                    className="accent-[#6639A6] w-4 h-4"
                  />
                  Sim
                </label>
                <label
                  className={`flex items-center gap-2 text-xs font-semibold text-gray-700 ${
                    canAccessRecurring ? 'cursor-pointer' : 'cursor-not-allowed'
                  }`}
                >
                  <input
                    type="radio"
                    name="recorrente"
                    checked={recorrente === 'nao'}
                    onChange={() => setRecorrente('nao')}
                    disabled={!canAccessRecurring}
                    className="accent-[#6639A6] w-4 h-4"
                  />
                  Não
                </label>
                {!canAccessRecurring && (
                  <Link
                    to="/planos"
                    className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-500"
                  >
                    Recurso VIP
                  </Link>
                )}
              </div>
            </div>

            {/* Prévia da fatura — regra do vencimento aplicada (só despesas de cartão) */}
            {!ehEntrada && faturaPrevista && cartaoSelecionado && (
              <p className="text-[11px] text-gray-500 bg-[#F6F3FB] rounded-xl px-3 py-2">
                Este lançamento entra na <strong>fatura de {rotuloFatura(faturaPrevista)}</strong>{' '}
                (vencimento dia {cartaoSelecionado.dia_vencimento}).
              </p>
            )}

            {/* Aviso de série — apagar-e-recriar */}
            {transacao.serie_id && (
              <p className="text-[11px] text-gray-500 bg-[#F6F3FB] rounded-xl px-3 py-2">
                {parcelaNumero > 0 && parcelaTotal > 0
                  ? `Esta é a parcela ${parcelaNumero} de ${parcelaTotal}. `
                  : 'Esta movimentação faz parte de uma série de parcelas. '}
                Ao salvar, <strong>todas as parcelas da série são apagadas e recriadas</strong>{' '}
                (mesmo as já pagas), com o valor, a data de início e o número de parcelas deste
                formulário.
              </p>
            )}

            {/* Ações */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="flex-1 py-3 text-xs font-bold text-[#6639A6] rounded-2xl bg-[#F1EAF9] hover:bg-[#E3D5F5] transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-3 text-xs font-bold text-white rounded-2xl bg-[#6639A6] hover:bg-[#522c8a] disabled:opacity-60 transition"
              >
                {saving ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
