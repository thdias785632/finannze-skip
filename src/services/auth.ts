import pb from '@/lib/pocketbase/client'
import type { User, UserPlan } from '@/types/financial'

export const authService = {
  getCurrentUser(): User | null {
    if (!pb.authStore.isValid || !pb.authStore.record) {
      return null
    }
    const rec = pb.authStore.record
    return {
      id: rec.id,
      email: rec.email,
      name: (rec.name as string) || (rec.email ? rec.email.split('@')[0] : 'Usuário'),
      plan: (rec.plan as UserPlan) || 'free',
      telefone: (rec.telefone as string) || undefined,
      avatar: rec.avatar as string | undefined,
      created: rec.created,
      updated: rec.updated,
    }
  },

  isAuthenticated(): boolean {
    return pb.authStore.isValid
  },

  async login(email: string, pass: string): Promise<User> {
    const authData = await pb.collection('users').authWithPassword(email, pass)
    const rec = authData.record
    return {
      id: rec.id,
      email: rec.email,
      name: (rec.name as string) || (rec.email ? rec.email.split('@')[0] : 'Usuário'),
      plan: (rec.plan as UserPlan) || 'free',
      telefone: (rec.telefone as string) || undefined,
      avatar: rec.avatar as string | undefined,
      created: rec.created,
      updated: rec.updated,
    }
  },

  async signup(name: string, email: string, pass: string, telefone: string): Promise<User> {
    // O cadastro acontece na ROTA DO BACKEND POST /backend/v1/auth/registrar
    // (pb_hooks/auth_registrar.pb.js): cria o usuário no plano 'free' e envia
    // o e-mail de boas-vindas INLINE — nesta instância Skip Cloud callbacks
    // onRecordAfterCreateSuccess não executam (bug comprovado), então nada
    // aqui depende de hook de evento.
    const resp = await fetch(
      `${import.meta.env.VITE_POCKETBASE_URL.replace(/\/$/, '')}/backend/v1/auth/registrar`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: name, email, senha: pass, telefone }),
      },
    )

    let corpo: { user?: { id?: string; plan?: string }; error?: string } = {}
    try {
      corpo = await resp.json()
    } catch {
      corpo = {}
    }

    if (!resp.ok) {
      throw new Error(corpo.error || 'Falha ao criar conta. Tente novamente.')
    }

    // Autentica logo em seguida (endpoint padrão do PocketBase, sem mudanças)
    return this.login(email, pass)
  },

  logout(): void {
    pb.authStore.clear()
    // Avisa o app (listener do authStore em AuthContext) que o usuário mudou.
    pb.authStore.save('', { id: '', email: '', name: '', plan: 'free' } as never)
  },

  async refreshUser(): Promise<User | null> {
    if (!pb.authStore.isValid) return null
    try {
      const rec = await pb.collection('users').authRefresh()
      return {
        id: rec.record.id,
        email: rec.record.email,
        name:
          (rec.record.name as string) ||
          (rec.record.email ? rec.record.email.split('@')[0] : 'Usuário'),
        plan: (rec.record.plan as UserPlan) || 'free',
        telefone: (rec.record.telefone as string) || undefined,
        avatar: rec.record.avatar as string | undefined,
        created: rec.record.created,
        updated: rec.record.updated,
      }
    } catch {
      return null
    }
  },
}
