import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { marcarBoasVindasPendentes } from '@/pages/BoasVindas'
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
import { PLANOS } from '@/lib/planos'
import { Crown, Check, Phone } from 'lucide-react'

interface AuthScreenProps {
  onSuccess?: () => void
}

/** Normaliza um telefone brasileiro para "+DDI DDDNUMERO" (ex.: +55 11 99999-8888 → "+5511999998888"). */
export function normalizarTelefoneComDdi(entrada: string): string | null {
  const digitos = entrada.replace(/\D/g, '')
  if (!digitos) return null
  let ddi = '55'
  let resto = digitos
  if (digitos.startsWith('55') && digitos.length > 11) {
    ddi = '55'
    resto = digitos.slice(2)
  } else if (digitos.length > 11) {
    // DDI diferente de 55 informado com mais de 11 dígitos no total
    return `+${digitos}`
  }
  if (resto.length < 10 || resto.length > 11) return null
  return `+${ddi}${resto}`
}

/** Formata dígito a dígito enquanto o usuário digita (padrão Brasil com DDI). */
function formatarTelefoneBr(input: string): string {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('55')) d = d.slice(2)
  d = d.slice(0, 11)
  if (!d) return ''
  const ddd = d.slice(0, 2)
  const rest = d.slice(2)
  let corpo = rest
  if (rest.length > 8) corpo = `${rest.slice(0, 5)}-${rest.slice(5, 10)}`
  else if (rest.length > 4) corpo = `${rest.slice(0, 4)}-${rest.slice(4)}`
  return `+55 (${ddd}${corpo ? `) ${corpo}` : ''}`
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [hidePassword, setHidePassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { login, signup } = useAuth()
  const navigate = useNavigate()

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

    if (mode === 'signup') {
      const telNormalizado = normalizarTelefoneComDdi(telefone)
      if (!telNormalizado) {
        setError('Informe um telefone válido com DDI, ex.: +55 (11) 99999-8888')
        return
      }
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
          description: 'Acesso realizado com sucesso ao Quitafy.',
        })
      } else {
        const telNormalizado = normalizarTelefoneComDdi(telefone) as string
        await signup(name, email, password, telNormalizado)
        // Cadastro NOVO passa pela tela de boas-vindas antes do Início.
        marcarBoasVindasPendentes()
        navigate('/boas-vindas', { replace: true })
        return
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
          QUITAFY
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
              {mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta no Quitafy'}
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

            {mode === 'signup' && (
              <div>
                <label
                  htmlFor="telefone-cadastro"
                  className="block text-xs font-semibold text-[#1F1438] mb-1"
                >
                  Telefone com DDI <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                  <input
                    id="telefone-cadastro"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(formatarTelefoneBr(e.target.value))}
                    placeholder="+55 (11) 99999-8888"
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-[#D9CDEB] bg-white text-[#1F1438] text-sm focus:outline-none focus:border-[#6639A6] focus:ring-2 focus:ring-[#6639A6]/15 transition"
                  />
                </div>
                <p className="text-[11px] text-[#6B7280] mt-1">
                  Usaremos para vincular seu WhatsApp (Premium) e seu contato.
                </p>
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
                  Entrar no Quitafy
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

          {/* Planos e preços — visíveis na aba de cadastro */}
          {mode === 'signup' && (
            <div className="mt-5 pt-4 border-t border-[#E2D6F0]">
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <Crown className="w-3.5 h-3.5 text-[#6639A6]" />
                <p className="text-xs font-bold text-[#1F1438]">Planos do Quitafy</p>
              </div>
              <div className="space-y-2">
                {PLANOS.filter((p) => p.id !== 'free').map((p) => (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl p-3 border border-[#E2D6F0] text-left"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-black text-[#1F1438]">{p.name}</p>
                      <p className="text-sm font-black text-[#4A247A]">
                        {p.price}
                        <span className="text-[10px] font-semibold text-gray-500">{p.period}</span>
                      </p>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {p.features
                        .filter((f) => f.included && !f.title.startsWith('Tudo'))
                        .filter((f) => f.title !== 'Prioridade em novos recursos do Quitafy')
                        .map((f, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-[11px] text-gray-600"
                          >
                            <Check className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                            {f.title}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#6B7280] mt-2.5 text-center leading-relaxed">
                Ativação dos planos VIP e Premium feita pelo administrador — sem cobrança automática
                no app.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Rodapé institucional */}
      <footer className="text-center text-xs text-white/50 z-10 pb-2">
        Quitafy © {new Date().getFullYear()}
      </footer>
    </div>
  )
}
