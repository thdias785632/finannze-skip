import React, { useCallback, useEffect, useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { BottomNav } from '@/components/BottomNav'
import { LogoLoader } from '@/components/LogoLoader'
import { gruposService } from '@/services/grupos'
import type { GrupoCompleto, MembroGrupo } from '@/services/grupos'
import { pb } from '@/lib/pocketbase/client'
import { toast } from '@/hooks/use-toast'
import { Users, UserPlus, Mail, Check, X, Trash2, Plus } from 'lucide-react'

/**
 * Aba de grupos: cria o grupo do usuário, convida pessoas por e-mail, lista
 * os membros (dono + convidados, aceitos e pendentes) e os convites que
 * chegaram para o usuário logado (aceitar/recusar).
 */
export const GruposPage: React.FC = () => {
  const [loading, setLoading] = useState(true)
  const [grupos, setGrupos] = useState<GrupoCompleto[]>([])
  const [convites, setConvites] = useState<MembroGrupo[]>([])
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [emailConvite, setEmailConvite] = useState('')
  const [convidando, setConvidando] = useState('')
  const [agindoConvite, setAgindoConvite] = useState('')

  const meuId = pb.authStore.record?.id

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [gs, conv] = await Promise.all([
        gruposService.meusGrupos(),
        gruposService.meusConvites().catch(() => []),
      ])
      setGrupos(gs)
      // Convites com os dados extras (nome do grupo etc.) são MembroGrupo +
      // nome_grupo; guardo como MembroGrupo estendido.
      setConvites(conv as unknown as MembroGrupo[])
    } catch (err) {
      console.error(err)
      toast({ variant: 'destructive', title: 'Erro ao carregar grupos' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const criar = async () => {
    if (!novoNome.trim()) {
      toast({ variant: 'destructive', title: 'Informe o nome do grupo' })
      return
    }
    setCriando(true)
    try {
      const g = await gruposService.criarGrupo(novoNome.trim())
      setGrupos((prev) => [...prev, { ...g, membros: [] }])
      setNovoNome('')
      toast({
        title: 'Grupo criado!',
        description: `Agora é só convidar pessoas para "${g.nome}".`,
      })
      await load()
    } catch (err) {
      console.error(err)
      toast({ variant: 'destructive', title: 'Erro ao criar grupo' })
    } finally {
      setCriando(false)
    }
  }

  const convidar = async (grupoId: string) => {
    if (!emailConvite.trim()) {
      toast({ variant: 'destructive', title: 'Informe o e-mail para convidar' })
      return
    }
    setConvidando(grupoId)
    try {
      await gruposService.convidar(emailConvite.trim())
      setEmailConvite('')
      toast({
        title: 'Convite enviado!',
        description: 'A pessoa aparece na lista quando entrar/aceitar.',
      })
      await load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao convidar'
      toast({ variant: 'destructive', title: msg })
    } finally {
      setConvidando('')
    }
  }

  const remover = async (membro: MembroGrupo) => {
    try {
      await gruposService.removerMembro(membro.id)
      toast({ title: 'Membro removido do grupo' })
      await load()
    } catch (err) {
      console.error(err)
      toast({ variant: 'destructive', title: 'Erro ao remover membro' })
    }
  }

  const aceitar = async (conviteId: string) => {
    setAgindoConvite(conviteId)
    try {
      await gruposService.aceitarConvite(conviteId)
      toast({ title: 'Convite aceito! Você já está no grupo.' })
      await load()
    } catch (err) {
      console.error(err)
      toast({ variant: 'destructive', title: 'Erro ao aceitar o convite' })
    } finally {
      setAgindoConvite('')
    }
  }

  const recusar = async (conviteId: string) => {
    setAgindoConvite(conviteId)
    try {
      await gruposService.recusarConvite(conviteId)
      toast({ title: 'Convite recusado' })
      await load()
    } catch (err) {
      console.error(err)
      toast({ variant: 'destructive', title: 'Erro ao recusar o convite' })
    } finally {
      setAgindoConvite('')
    }
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

  const convitesDetalhes = convites as unknown as Array<
    MembroGrupo & { nome_grupo?: string; dono_email?: string }
  >

  return (
    <div className="min-h-screen bg-[#F6F3FB] text-[#1F1438] pb-24">
      <AppHeader />

      <main className="max-w-md mx-auto px-4 pt-4 pb-10">
        <h1 className="text-lg font-black text-[#1F1438] mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#6639A6]" />
          Grupos
        </h1>

        {/* Convites que chegaram para mim */}
        {convitesDetalhes.length > 0 && (
          <div className="mb-4 space-y-2">
            {convitesDetalhes.map((c) => (
              <div
                key={c.id}
                className="bg-white rounded-2xl p-4 border border-[#EBE4F5] shadow-[0_4px_24px_rgba(102,57,166,0.08)]"
              >
                <p className="text-sm font-bold flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#6639A6]" />
                  Convite para "{c.nome_grupo || 'um grupo'}"
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  De {c.dono_email || 'alguém'} · para {c.email}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    type="button"
                    disabled={agindoConvite === c.id}
                    onClick={() => void aceitar(c.id)}
                    className="flex-1 py-2 text-xs font-bold text-white rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Aceitar
                  </button>
                  <button
                    type="button"
                    disabled={agindoConvite === c.id}
                    onClick={() => void recusar(c.id)}
                    className="flex-1 py-2 text-xs font-bold text-red-500 rounded-xl bg-red-50 hover:bg-red-100 disabled:opacity-60 transition flex items-center justify-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    Recusar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Criar grupo */}
        <div className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.08)] border border-[#EBE4F5] mb-4">
          <p className={labelCls}>Criar um novo grupo</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="Ex.: Casa, Família, Apê"
              className={inputCls}
            />
            <button
              type="button"
              disabled={criando}
              onClick={() => void criar()}
              className="shrink-0 h-11 px-4 rounded-xl bg-[#6639A6] text-white text-xs font-bold hover:bg-[#522c8a] disabled:opacity-60 transition flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Criar
            </button>
          </div>
        </div>

        {/* Lista de grupos */}
        {grupos.length === 0 && (
          <div className="bg-white rounded-3xl p-8 text-center border border-[#EBE4F5]">
            <Users className="w-8 h-8 text-[#6639A6]/40 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">Você ainda não participa de grupos</p>
            <p className="text-xs text-gray-500 mt-1">
              Crie um grupo acima e convide pessoas pelo e-mail para dividir lançamentos.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {grupos.map((g) => (
            <div
              key={g.id}
              className="bg-white rounded-3xl p-5 shadow-[0_4px_24px_rgba(102,57,166,0.08)] border border-[#EBE4F5]"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-black text-[#1F1438]">{g.nome}</p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#6639A6]/12 text-[#6639A6] uppercase">
                  {g.papel === 'dono' ? 'Dono' : 'Membro'}
                </span>
              </div>

              {/* Membros */}
              <ul className="space-y-2">
                {g.membros.length === 0 && (
                  <li className="text-xs text-gray-500">
                    Nenhum membro ainda — convide pelo e-mail.
                  </li>
                )}
                {g.membros.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-[#F3EFF9] last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#1F1438] truncate">
                        {m.nome || m.email}
                        {m.status === 'pendente' && (
                          <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                            Pendente
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">{m.email}</p>
                    </div>
                    {g.papel === 'dono' && m.papel !== 'dono' && (
                      <button
                        type="button"
                        onClick={() => void remover(m)}
                        className="shrink-0 p-1.5 rounded-full text-red-500 hover:bg-red-50 transition"
                        aria-label="Remover membro"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {/* Convidar */}
              <div className="mt-3">
                <p className={labelCls}>Convidar por e-mail</p>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={emailConvite}
                    onChange={(e) => setEmailConvite(e.target.value)}
                    placeholder="pessoa@email.com"
                    className={inputCls}
                  />
                  <button
                    type="button"
                    disabled={convidando === g.id}
                    onClick={() => void convidar(g.id)}
                    className="shrink-0 h-11 px-4 rounded-xl bg-[#6639A6] text-white text-xs font-bold hover:bg-[#522c8a] disabled:opacity-60 transition flex items-center gap-1"
                  >
                    <UserPlus className="w-4 h-4" />
                    Convidar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
