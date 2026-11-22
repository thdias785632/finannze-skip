import React, { useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import {
  Eye,
  EyeOff,
  ArrowRight,
  LogIn,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Home,
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface AuthScreenProps {
  onSuccess?: () => void
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [hidePassword, setHidePassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { login, signup } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email || !password) {
      setError('Preencha e-mail e senha')
      return
    }

    if (mode === 'signup' && !name) {
      setError('Informe seu nome completo')
      return
    }

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        toast({
          title: 'Bem-vindo de volta!',
          description: 'Acesso realizado com sucesso ao Finanzze.',
        })
      } else {
        await signup(name, email, password)
        toast({
          title: 'Conta criada com sucesso!',
          description: 'Sua jornada no Finanzze começou.',
        })
      }
      onSuccess?.()
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Falha ao autenticar. Verifique e-mail e senha.'
      setError(msg)
      toast({
        variant: 'destructive',
        title: mode === 'login' ? 'Falha ao entrar' : 'Falha ao criar conta',
        description: msg,
      })
    } finally {
      setLoading(false)
    }
  }

  // Preenche dados da conta de exemplo com 1 clique para facilidade
  const handleQuickDemo = () => {
    setEmail('thiago.dias.148116@gmail.com')
    setPassword('Skip@Pass')
    setMode('login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1A0E2E] via-[#2A1548] to-[#1A0E2E] text-white flex flex-col items-center justify-between px-4 py-8 relative overflow-hidden">
      {/* Luz radial de fundo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#9D4EDD]/20 blur-[120px] pointer-events-none rounded-full" />

      {/* Cabeçalho Hero com visual idêntico ao original */}
      <header className="flex flex-col items-center text-center max-w-md pt-4 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-purple-200 font-medium mb-3">
          <Sparkles className="w-3.5 h-3.5 text-purple-300" />
          Finanças Pessoais & Imóveis na Planta
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-widest text-white uppercase drop-shadow-md">
          FINANZZE
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-white/70 max-w-xs font-normal">
          Controle financeiro inteligente, extrato mês a mês e correção de imóveis pelo INCC
        </p>

        {/* Badges dos recursos principais */}
        <div className="grid grid-cols-3 gap-2 mt-4 w-full">
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 flex flex-col items-center text-center">
            <TrendingUp className="w-4 h-4 text-emerald-400 mb-1" />
            <span className="text-[11px] font-medium text-white/90">Dashboard</span>
            <span className="text-[10px] text-white/50">Donut visual</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 flex flex-col items-center text-center">
            <ShieldCheck className="w-4 h-4 text-purple-300 mb-1" />
            <span className="text-[11px] font-medium text-white/90">Recorrentes</span>
            <span className="text-[10px] text-white/50">VIP & Premium</span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2 flex flex-col items-center text-center">
            <Home className="w-4 h-4 text-amber-300 mb-1" />
            <span className="text-[11px] font-medium text-white/90">Imóveis INCC</span>
            <span className="text-[10px] text-white/50">Banco Central</span>
          </div>
        </div>
      </header>

      {/* Cartão de Login / Cadastro em tom suave #F4F1F9 */}
      <section className="w-full max-w-[420px] my-6 z-10">
        <div className="bg-[#F4F1F9] text-[#1F1438] rounded-3xl p-6 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.5)] border border-purple-200/50">
          {/* Tabs de Seleção */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-[#6639A6]/10 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white text-[#4A247A] shadow-[0_1px_4px_rgba(31,20,56,0.12)]'
                  : 'text-[#6B7280] hover:text-[#1F1438]'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setMode('signup')}
              className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${
                mode === 'signup'
                  ? 'bg-white text-[#4A247A] shadow-[0_1px_4px_rgba(31,20,56,0.12)]'
                  : 'text-[#6B7280] hover:text-[#1F1438]'
              }`}
            >
              Criar conta
            </button>
          </div>

          <div className="text-center mb-5">
            <h2 className="text-xl font-bold tracking-tight text-[#1F1438]">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta no Finanzze'}
            </h2>
            <p className="text-xs text-[#6B7280] mt-1">
              {mode === 'login'
                ? 'Entre para continuar controlando suas contas e extratos.'
                : 'Leva menos de um minuto para começar a poupar.'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-semibold text-[#1F1438] mb-1">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full h-11 px-3.5 rounded-xl border border-[#D9CDEB] bg-white text-[#1F1438] text-sm focus:outline-none focus:border-[#6639A6] focus:ring-2 focus:ring-[#6639A6]/15 transition"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#1F1438] mb-1">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full h-11 px-3.5 rounded-xl border border-[#D9CDEB] bg-white text-[#1F1438] text-sm focus:outline-none focus:border-[#6639A6] focus:ring-2 focus:ring-[#6639A6]/15 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1F1438] mb-1">Senha</label>
              <div className="relative">
                <input
                  type={hidePassword ? 'password' : 'text'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full h-11 px-3.5 pr-11 rounded-xl border border-[#D9CDEB] bg-white text-[#1F1438] text-sm focus:outline-none focus:border-[#6639A6] focus:ring-2 focus:ring-[#6639A6]/15 transition"
                />
                <button
                  type="button"
                  onClick={() => setHidePassword(!hidePassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-[#6B7280] hover:text-[#6639A6]"
                  aria-label={hidePassword ? 'Mostrar senha' : 'Ocultar senha'}
                >
                  {hidePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="text-[11px] text-[#6B7280] mt-1">Mínimo de 8 caracteres</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4A247A] via-[#6639A6] to-[#7A45BF] text-white font-semibold text-sm shadow-[0_8px_20px_rgba(102,57,166,0.35)] hover:opacity-95 active:scale-[0.99] transition disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === 'login' ? (
                <>
                  Entrar no Finanzze
                  <LogIn className="w-4 h-4" />
                </>
              ) : (
                <>
                  Criar conta agora
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-[#6B7280] mt-4">
            {mode === 'login' ? 'Ainda não tem conta?' : 'Já possui uma conta?'}{' '}
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-[#6639A6] font-bold hover:underline"
            >
              {mode === 'login' ? 'Criar agora' : 'Fazer login'}
            </button>
          </p>
        </div>
      </section>

      {/* Rodapé institucional */}
      <footer className="text-center text-xs text-white/50 z-10 pb-2">
        Finanzze © {new Date().getFullYear()} • Identidade roxa original preservada
      </footer>
    </div>
  )
}
