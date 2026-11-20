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
      avatar: rec.avatar as string | undefined,
      created: rec.created,
      updated: rec.updated,
    }
  },

  async signup(name: string, email: string, pass: string): Promise<User> {
    // Cria novo usuário (nasce no plano 'free')
    await pb.collection('users').create({
      email,
      password: pass,
      passwordConfirm: pass,
      name,
      plan: 'free',
    })

    // Autentica logo em seguida
    return this.login(email, pass)
  },

  logout(): void {
    pb.authStore.clear()
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
        avatar: rec.record.avatar as string | undefined,
        created: rec.record.created,
        updated: rec.record.updated,
      }
    } catch {
      return null
    }
  },
}
