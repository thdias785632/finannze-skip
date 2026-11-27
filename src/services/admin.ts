import pb from '@/lib/pocketbase/client'
import type { UserPlan } from '@/types/financial'

const BASE = import.meta.env.VITE_POCKETBASE_URL.replace(/\/$/, '')

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: pb.authStore.token,
  }
}

async function lerErro(resp: Response): Promise<string> {
  try {
    const corpo = await resp.json()
    return corpo.error || ''
  } catch {
    return ''
  }
}

// ---------- Dashboard admin ----------

export interface ResumoAdmin {
  total_usuarios: number
  novos_7_dias: number
  novos_30_dias: number
  por_plano: Record<UserPlan, number>
  atendimentos_pendentes: number
}

/** Contagens do painel — rota protegida por is_admin no backend. */
export async function resumoAdmin(): Promise<ResumoAdmin> {
  const resp = await fetch(`${BASE}/backend/v1/admin/resumo`, { headers: headers() })
  if (resp.status === 403) throw new Error('Acesso restrito ao administrador')
  if (!resp.ok) throw new Error((await lerErro(resp)) || 'Erro ao carregar o resumo')
  return await resp.json()
}

// ---------- Usuários ----------

export interface UsuarioAdmin {
  id: string
  nome: string
  email: string
  telefone: string
  plano: UserPlan
  is_admin: boolean
  whatsapp_numero: string
  created: string
  updated: string
}

export interface FormUsuarioAdmin {
  nome?: string
  telefone?: string
  plano?: UserPlan
  is_admin?: boolean
}

/** Lista todos os usuários com busca opcional por nome/e-mail/telefone. */
export async function listarUsuarios(q?: string): Promise<UsuarioAdmin[]> {
  const url =
    q && q.trim()
      ? `${BASE}/backend/v1/admin/usuarios?q=${encodeURIComponent(q)}`
      : `${BASE}/backend/v1/admin/usuarios`
  const resp = await fetch(url, { headers: headers() })
  if (resp.status === 403) throw new Error('Acesso restrito ao administrador')
  if (!resp.ok) throw new Error((await lerErro(resp)) || 'Erro ao carregar usuários')
  const corpo: { usuarios?: UsuarioAdmin[] } = await resp.json()
  return corpo.usuarios || []
}

/** Edita nome, telefone (sincronizando whatsapp_contas), plano e is_admin. */
export async function atualizarUsuario(id: string, dados: FormUsuarioAdmin): Promise<UsuarioAdmin> {
  const resp = await fetch(`${BASE}/backend/v1/admin/usuarios/atualizar`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ id, ...dados }),
  })
  if (!resp.ok) throw new Error((await lerErro(resp)) || 'Erro ao atualizar o usuário')
  const corpo: { usuario?: UsuarioAdmin } = await resp.json()
  if (!corpo.usuario) throw new Error('Resposta inesperada do servidor')
  return corpo.usuario
}
