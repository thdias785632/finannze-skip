import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, LifeBuoy, UserRound, Bot, LoaderCircle } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { useAuth } from '@/context/AuthContext'
import { enviarAjuda, historicoAjuda, type MensagemAjuda } from '@/services/suporte'
import { formatarHora } from '@/lib/suporteFormat'

interface Bolha extends MensagemAjuda {
  local?: boolean
  falhou?: boolean
}

/**
 * Tela de Ajuda: chat do cliente com o agente de suporte do Quitafy.
 * Aberta pelo item "Ajuda" no menu do perfil. Quando o agente não sabe
 * responder, ele escalona e o atendimento aparece na tela Atendimentos
 * (visível só para o admin).
 */
export const AjudaPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [mensagens, setMensagens] = useState<Bolha[]>([])
  const [carregando, setCarregando] = useState(true)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let ativo = true
    historicoAjuda()
      .then((lista) => {
        if (ativo) setMensagens(lista)
      })
      .catch(() => {})
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [user?.id])

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens.length, enviando])

  const enviar = async () => {
    const pergunta = texto.trim()
    if (!pergunta || enviando) return
    setTexto('')
    const localId = `local-${Date.now()}`
    setMensagens((m) => [
      ...m,
      {
        id: localId,
        papel: 'cliente',
        texto: pergunta,
        created: new Date().toISOString(),
        local: true,
      },
    ])
    setEnviando(true)
    try {
      const { resposta, escalonado } = await enviarAjuda(pergunta)
      setMensagens((m) => [
        ...m,
        {
          id: `resp-${Date.now()}`,
          papel: 'agente',
          texto: resposta,
          created: new Date().toISOString(),
          local: false,
        },
      ])
      if (escalonado) {
        setMensagens((m) => [
          ...m,
          {
            id: `aviso-${Date.now()}`,
            papel: 'agente',
            texto:
              '📲 Sua dúvida virou um atendimento: o time do Quitafy vai te responder ' +
              'por aqui mesmo (ou pelo WhatsApp).',
            created: new Date().toISOString(),
            local: true,
          },
        ])
      }
    } catch {
      setMensagens((m) => m.map((x) => (x.id === localId ? { ...x, falhou: true } : x)))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#F5F3F7] pb-28 flex flex-col">
      <AppHeader />

      <div className="max-w-md mx-auto px-4 pt-4 w-full flex-1 flex flex-col">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Voltar para a tela anterior"
          className="mb-3 self-start flex items-center gap-1.5 text-sm font-semibold text-[#6639A6] hover:underline"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F1EAF9]"
          >
            <LifeBuoy className="w-6 h-6 text-[#6639A6]" />
          </span>
          <div>
            <h1 className="text-xl font-black text-[#1F1438]">Ajuda</h1>
            <p className="text-xs text-gray-500">Tire suas dúvidas sobre o Quitafy</p>
          </div>
        </div>

        <div
          role="log"
          aria-label="Conversa com o suporte"
          className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[#E2D6F0] bg-white p-4"
        >
          {carregando ? (
            <p className="text-sm text-gray-400">Carregando conversa…</p>
          ) : mensagens.length === 0 ? (
            <div className="text-center py-6">
              <Bot aria-hidden="true" className="w-8 h-8 mx-auto text-[#B9A5D6]" />
              <p className="mt-2 text-sm font-semibold text-[#1F1438]">
                Olá! Eu sou o assistente do Quitafy 🤖
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Pergunte o que quiser sobre o app — e, se eu não souber, passo sua dúvida para o
                time.
              </p>
            </div>
          ) : (
            mensagens.map((m) => (
              <div
                key={m.id}
                className={
                  m.papel === 'cliente' ? 'flex flex-col items-end' : 'flex flex-col items-start'
                }
              >
                <div
                  className={
                    'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ' +
                    (m.papel === 'cliente'
                      ? 'bg-[#6639A6] text-white'
                      : 'bg-[#F1EAF9] text-[#1F1438]')
                  }
                >
                  {m.texto}
                </div>
                <span className="mt-0.5 flex items-center gap-1 px-1 text-[10px] text-gray-400">
                  {m.papel === 'cliente' ? (
                    <UserRound className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Bot className="h-3 w-3" aria-hidden="true" />
                  )}
                  {formatarHora(m.created)}
                  {m.falhou && <span className="font-semibold text-red-500">— não enviada</span>}
                </span>
              </div>
            ))
          )}
          {enviando && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              Assistente digitando…
            </div>
          )}
          <div ref={fimRef} />
        </div>

        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void enviar()
          }}
        >
          <label htmlFor="ajuda-texto" className="sr-only">
            Escreva sua dúvida
          </label>
          <textarea
            id="ajuda-texto"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void enviar()
              }
            }}
            rows={2}
            placeholder="Escreva sua dúvida…"
            className="flex-1 resize-none rounded-2xl border border-[#E2D6F0] bg-white px-4 py-2.5 text-sm text-[#1F1438] placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6639A6]"
          />
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            aria-label="Enviar dúvida"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#6639A6] text-white disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-[#6639A6] focus-visible:ring-offset-2"
          >
            {enviando ? (
              <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </form>
      </div>

      <BottomNav />
    </div>
  )
}
