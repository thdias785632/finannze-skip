import pb from '@/lib/pocketbase/client'
import type { User } from '@/types/financial'

/** Membro de um grupo do usuário — o próprio, convidados aceitos e pendentes. */
export interface MembroGrupo {
  /** id do registro em grupos_membros (não do usuário) */
  id: string
  grupo_id: string
  /** id do usuário no PocketBase ('' quando o convite ainda não foi aceito) */
  user_id: string
  email: string
  nome: string
  papel: 'dono' | 'membro'
  status: 'aceito' | 'pendente'
  created: string
}

/** Convite que chega para o usuário logado (grupos_membros.user_id = eu, pendente). */
export interface ConvitePendente extends MembroGrupo {
  nome_grupo: string
  dono_email: string
}

/** Grupo do usuário, com os membros embutidos (dono + convidados). */
export interface GrupoCompleto {
  id: string
  nome: string
  papel: 'dono' | 'membro'
  membros: MembroGrupo[]
  created: string
}

const mapMembro = (r: Record<string, any>): MembroGrupo => ({
  id: r.id,
  grupo_id: r.grupo_id,
  user_id: r.user_id || '',
  email: String(r.email || ''),
  nome: String(r.nome || ''),
  papel: r.papel === 'dono' ? 'dono' : 'membro',
  status: r.status === 'pendente' ? 'pendente' : 'aceito',
  created: r.created,
})

const mapGrupo = async (r: Record<string, any>, meuId: string): Promise<GrupoCompleto> => {
  const membros = await pb
    .collection('grupos_membros')
    .getFullList({ filter: `grupo_id = "${r.id}"`, sort: 'created' })
  return {
    id: r.id,
    nome: String(r.nome || 'Meu grupo'),
    papel: r.user_id === meuId ? 'dono' : 'membro',
    membros: membros.map(mapMembro),
    created: r.created,
  }
}

export const gruposService = {
  /**
   * Membros com quem o usuário pode compartilhar: de TODOS os grupos em que
   * ele participa (dono ou convidado), todas as pessoas menos ele mesmo.
   */
  async meusMembros(meuId?: string): Promise<MembroGrupo[]> {
    const uid = meuId || pb.authStore.record?.id
    if (!uid) return []
    const meusGrupos = await pb.collection('grupos_membros').getFullList({
      filter: `user_id = "${uid}" && status = "aceito"`,
    })
    if (meusGrupos.length === 0) return []
    const filtro = meusGrupos.map((g) => `grupo_id = "${g.grupo_id}"`).join(' || ')
    const todos = await pb.collection('grupos_membros').getFullList({ filter: filtro })
    return todos.filter((r) => r.user_id !== uid && r.status === 'aceito').map(mapMembro)
  },

  /** Grupos em que o usuário participa (dono ou convidado), com membros. */
  async meusGrupos(meuId?: string): Promise<GrupoCompleto[]> {
    const uid = meuId || pb.authStore.record?.id
    if (!uid) return []
    const participacoes = await pb.collection('grupos_membros').getFullList({
      filter: `user_id = "${uid}" && status = "aceito"`,
      sort: 'created',
    })
    const grupos: GrupoCompleto[] = []
    for (const p of participacoes) {
      const g = await pb.collection('grupos').getOne(p.grupo_id)
      grupos.push(await mapGrupo(g, uid))
    }
    return grupos
  },

  /** Cria o grupo do usuário (idempotente no front: um grupo por pessoa). */
  async criarGrupo(nome = 'Meu grupo'): Promise<GrupoCompleto> {
    const uid = pb.authStore.record?.id
    if (!uid) throw new Error('Usuário não autenticado')
    const g = await pb.collection('grupos').create({ user_id: uid, nome })
    await pb.collection('grupos_membros').create({
      grupo_id: g.id,
      user_id: uid,
      email: pb.authStore.record?.email || '',
      nome: pb.authStore.record?.name || '',
      papel: 'dono',
      status: 'aceito',
    })
    return { id: g.id, nome, papel: 'dono', membros: [], created: g.created }
  },

  /**
   * Convida pelo e-mail. Se o e-mail já tem conta no app, o membro já nasce
   * vinculado (status aceito). Sem conta, nasce pendente: quando a pessoa se
   * cadastrar com esse e-mail, o hook do backend vincula automaticamente e
   * envia o e-mail de convite.
   */
  async convidar(email: string): Promise<MembroGrupo> {
    const uid = pb.authStore.record?.id
    if (!uid) throw new Error('Usuário não autenticado')
    const meuEmail = String(pb.authStore.record?.email || '').toLowerCase()
    const alvo = email.trim().toLowerCase()
    if (!alvo || !alvo.includes('@')) throw new Error('Informe um e-mail válido')
    if (alvo === meuEmail) throw new Error('Este é o seu próprio e-mail')

    const grupos = await this.meusGrupos(uid)
    let grupo = grupos.find((g) => g.papel === 'dono')
    if (!grupo) grupo = await this.criarGrupo()

    // Já existe conta com esse e-mail? vincula direto.
    let usuarioId = ''
    let nome = ''
    try {
      const u = await pb.collection('users').getFirstListItem(`email = "${alvo}"`)
      usuarioId = u.id
      nome = String(u.name || '')
    } catch (_) {
      /* sem conta ainda: convite fica pendente */
    }

    // Já é membro do grupo?
    const jaExiste = await pb
      .collection('grupos_membros')
      .getFullList({ filter: `grupo_id = "${grupo.id}" && email = "${alvo}"` })
    if (jaExiste.length > 0) throw new Error('Esta pessoa já está no seu grupo')

    const rec = await pb.collection('grupos_membros').create({
      grupo_id: grupo.id,
      user_id: usuarioId,
      email: alvo,
      nome,
      papel: 'membro',
      status: usuarioId ? 'aceito' : 'pendente',
    })

    // E-mail de convite (rota do backend; falha não bloqueia o vínculo).
    try {
      await pb.send('/backend/v1/grupos/convidar', {
        method: 'POST',
        body: { membro_id: rec.id },
      })
    } catch (_) {
      /* best-effort */
    }

    return mapMembro(rec)
  },

  /** Remove um membro do grupo (só o dono pode). */
  async removerMembro(membroId: string): Promise<void> {
    await pb.collection('grupos_membros').delete(membroId)
  },

  /** Convites pendentes para o usuário logado (para ele aceitar/recusar). */
  async meusConvites(): Promise<ConvitePendente[]> {
    const uid = pb.authStore.record?.id
    const meuEmail = String(pb.authStore.record?.email || '').toLowerCase()
    if (!uid) return []
    // Pendentes vinculados ao meu id OU gravados antes de eu ter conta (só e-mail).
    const registros = await pb.collection('grupos_membros').getFullList({
      filter: `status = "pendente" && (user_id = "${uid}" || (user_id = "" && email = "${meuEmail}"))`,
    })
    const convites: ConvitePendente[] = []
    for (const r of registros) {
      let nomeGrupo = 'Grupo'
      let donoEmail = ''
      try {
        const g = await pb.collection('grupos').getOne(r.grupo_id)
        nomeGrupo = String(g.nome || 'Grupo')
        const dono = await pb
          .collection('grupos_membros')
          .getFirstListItem(`grupo_id = "${r.grupo_id}" && papel = "dono"`)
        donoEmail = String(dono.email || '')
      } catch {
        /* intentionally ignored */
      }
      convites.push({ ...mapMembro(r), nome_grupo: nomeGrupo, dono_email: donoEmail })
    }
    return convites
  },

  /** Aceita um convite: fica membro do grupo (o hook já tinha vinculado o id). */
  async aceitarConvite(conviteId: string): Promise<void> {
    await pb.collection('grupos_membros').update(conviteId, {
      user_id: pb.authStore.record?.id,
      status: 'aceito',
    })
  },

  /** Recusa/remove um convite pendente endereçado ao usuário logado. */
  async recusarConvite(conviteId: string): Promise<void> {
    await pb.collection('grupos_membros').delete(conviteId)
  },
}

/** Tipo utilitário reexportado para telas que só precisam do usuário. */
export type { User }
