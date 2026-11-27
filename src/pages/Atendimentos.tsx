import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Inbox,
  Send,
  LoaderCircle,
  MessageCircle,
  ShieldCheck,
  ChevronLeft,
} from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { useAuth } from '@/context/AuthContext'
import { useVerComoCliente } from '@/context/VerComoClienteContext'
import {
  listarAtendimentos,
  detalheAtendimento,
  responderAtendimento,
  type Atendimento,
  type AtendimentoDetalhe,
} from '@/services/suporte'
import { formatarHora, formatarHoraCompleta, formatarTelefone } from '@/lib/suporteFormat'

/**
 * Caixa de entrada dos atendimentos — SÓ para admin (is_admin=true) e só na
 * visão de admin (o toggle "Ver como cliente" esconde a tela). A resposta do
 * admin sai pela caixa de entrada e chega no WhatsApp do cliente.
 */
export const AtendimentosPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { verComoCliente } = useVerComoCliente()
  const ehAdmin = !!user?.is_admin && !verComoCliente

  const [lista, setLista] = useState<Atendimento[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [abertoId, setAbertoId] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<AtendimentoDetalhe | null>(null)
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false)
  const [resposta, setResposta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aviso, setAviso] = useState('')

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro('')
    try {
      setLista(await listarAtendimentos())
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar atendimentos')
    } finally {
      setCarregando(false)
    }
  }, [])

  const abrir = async (id: string) => {
    setAviso('')
    setAbertoId(id)
    setCarregandoDetalhe(true)
    setDetalhe(null)
    try {
      setDetalhe(await detalheAtendimento(id))
    } catch {
      setAviso('Não foi possível abrir o atendimento.')
    } finally {
      setCarregandoDetalhe(false)
    }
  }

  const responder = async () => {
    const texto = resposta.trim()
    if (!texto || !abertoId || enviando) return
    setEnviando(true)
    setAviso('')
    try {
      const resultado = await responderAtendimento(abertoId, texto)
      setResposta('')
      if (!resultado.whatsapp_entregue && resultado.aviso) {
        setAviso(resultado.aviso)
      }
      await abrir(abertoId)
      await carregar()
    } catch (err) {
      setAviso(err instanceof Error ? err.message : 'Erro ao enviar a resposta')
    } finally {
      setEnviando(false)
    }
  }

  useEffect(() => {
    if (ehAdmin) void carregar()
  }, [ehAdmin, carregar])

  if (!ehAdmin) {
    // Usuário comum (ou admin em modo cliente) não entra aqui.
    return (
      <div className="min-h-dvh bg-[#F5F3F7] pb-24">
        <AppHeader />
        <div className="max-w-md mx-auto px-4 pt-10 text-center">
          <ShieldCheck aria-hidden="true" className="w-10 h-10 mx-auto text-[#B9A5D6]" />
          <h1 className="mt-3 text-lg font-black text-[#1F1438]">Área do administrador</h1>
          <p className="mt-1 text-sm text-gray-500">
            Esta tela é exclusiva do time de suporte do Quitafy.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="mt-4 rounded-full bg-[#6639A6] px-5 py-2 text-sm font-semibold text-white focus-visible:ring-2 focus-visible:ring-[#6639A6] focus-visible:ring-offset-2"
          >
            Ir para o Resumo
          </button>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#F5F3F7] pb-24">
      <AppHeader />

      <div className="max-w-md mx-auto px-4 pt-4">
        {abertoId ? (
          <>
            <button
              type="button"
              onClick={() => {
                setAbertoId(null)
                setDetalhe(null)
                setAviso('')
              }}
              aria-label="Voltar para a lista de atendimentos"
              className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[#6639A6] hover:underline"
            >
              <ChevronLeft className="w-4 h-4" /> Atendimentos
            </button>

            {carregandoDetalhe ? (
              <p className="text-sm text-gray-400">Carregando…</p>
            ) : detalhe ? (
              <div className="rounded-3xl border border-[#E2D6F0] bg-white p-4 shadow-sm">
                <h1 className="text-base font-black text-[#1F1438] break-words">
                  {detalhe.assunto || 'Atendimento'}
                </h1>
                <p className="mt-0.5 text-xs text-gray-500">
                  {detalhe.cliente}
                  {detalhe.cliente_telefone
                    ? ' · ' + formatarTelefone(detalhe.cliente_telefone)
                    : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  Aberto em {formatarHoraCompleta(detalhe.created)} · status:{' '}
                  <span className="font-semibold text-[#6639A6]">{detalhe.status}</span>
                </p>

                <div
                  role="log"
                  aria-label="Mensagens do atendimento"
                  className="mt-4 max-h-72 space-y-3 overflow-y-auto pr-1"
                >
                  {detalhe.mensagens.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.autor_papel === 'admin'
                          ? 'flex flex-col items-end'
                          : 'flex flex-col items-start'
                      }
                    >
                      <div
                        className={
                          'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ' +
                          (m.autor_papel === 'admin'
                            ? 'bg-[#6639A6] text-white'
                            : 'bg-[#F1EAF9] text-[#1F1438]')
                        }
                      >
                        {m.texto}
                      </div>
                      <span className="mt-0.5 px-1 text-[10px] text-gray-400">
                        {m.autor_papel === 'admin' ? 'Você' : 'Cliente'} · {formatarHora(m.created)}
                      </span>
                    </div>
                  ))}
                </div>

                {aviso && (
                  <p
                    role="status"
                    className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"
                  >
                    {aviso}
                  </p>
                )}

                <form
                  className="mt-4 flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void responder()
                  }}
                >
                  <label htmlFor="resposta-texto" className="sr-only">
                    Sua resposta
                  </label>
                  <textarea
                    id="resposta-texto"
                    value={resposta}
                    onChange={(e) => setResposta(e.target.value)}
                    rows={2}
                    placeholder="Escreva a resposta para o cliente…"
                    className="flex-1 resize-none rounded-2xl border border-[#E2D6F0] bg-white px-4 py-2.5 text-sm text-[#1F1438] placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6639A6]"
                  />
                  <button
                    type="submit"
                    disabled={!resposta.trim() || enviando}
                    aria-label="Enviar resposta ao cliente"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#6639A6] text-white disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#6639A6] focus-visible:ring-offset-2"
                  >
                    {enviando ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-5 w-5" aria-hidden="true" />
                    )}
                  </button>
                </form>
                <p className="mt-1.5 text-[11px] text-gray-400">
                  A resposta é enviada pelo WhatsApp do Quitafy para o número do cliente.
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Voltar para a tela anterior"
              className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[#6639A6] hover:underline"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar
            </button>

            <div className="mb-4 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1EAF9]"
              >
                <Inbox className="w-6 h-6 text-[#6639A6]" />
              </span>
              <div>
                <h1 className="text-xl font-black text-[#1F1438]">Atendimentos</h1>
                <p className="text-xs text-gray-500">Dúvidas que o assistente passou para o time</p>
              </div>
            </div>

            {carregando ? (
              <p className="text-sm text-gray-400">Carregando…</p>
            ) : erro ? (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
            ) : lista.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-[#E2D6F0] bg-white p-8 text-center">
                <MessageCircle aria-hidden="true" className="mx-auto w-8 h-8 text-[#B9A5D6]" />
                <p className="mt-2 text-sm font-semibold text-[#1F1438]">
                  Nenhum atendimento por aqui
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Quando o assistente não souber responder uma dúvida, ela aparece nesta lista.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {lista.map((at) => (
                  <li key={at.id}>
                    <button
                      type="button"
                      onClick={() => void abrir(at.id)}
                      className="w-full rounded-3xl border border-[#E2D6F0] bg-white p-4 text-left shadow-sm transition hover:border-[#6639A6] focus-visible:ring-2 focus-visible:ring-[#6639A6]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-[#1F1438] line-clamp-2">
                          {at.assunto || 'Atendimento'}
                        </p>
                        <span
                          className={
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ' +
                            (at.status === 'aberto'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-700')
                          }
                        >
                          {at.status === 'aberto' ? 'Aberto' : 'Respondido'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{at.cliente}</p>
                      {at.ultima_mensagem && (
                        <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                          {at.ultima_mensagem}
                        </p>
                      )}
                      <p className="mt-1.5 text-[10px] text-gray-400">
                        {formatarHora(at.created)} · {at.total_mensagens} mensagem
                        {at.total_mensagens === 1 ? '' : 's'}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
