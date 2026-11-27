import type { UserPlan } from '@/types/financial'

/**
 * Configuração única dos planos do Quitafy, usada pela tela de Planos, pela
 * tela de boas-vindas, pela AuthScreen e por qualquer surface futura.
 *
 * Hierarquia (cada plano inclui tudo do anterior):
 *   Básico (gratuito) → Bronze R$ 14,99 → Ouro R$ 29,99
 *   - Bronze: despesas recorrentes + extratos de todos os meses (inclusive futuros)
 *   - Ouro:   tudo do Bronze + imóveis na planta com correção INCC
 *
 * O Prata (R$ 24,99, lançamentos pelo WhatsApp) está DESATIVADO por ora:
 * `disponivel: false` — aparece na interface como "Em breve", sem botão de
 * assinar, e o checkout dele é negado também no backend (assinaturas.pb.js).
 * Nenhum plano ativo oferece WhatsApp como benefício.
 */
export interface BeneficioPlano {
  title: string
  included: boolean
  reason?: string
}

export interface PlanoConfig {
  id: UserPlan
  name: string
  tagline: string
  price: string
  period?: string
  popular?: boolean
  color: string
  features: BeneficioPlano[]
  /**
   * false = plano ainda não comercializado ("Em breve"): a interface esmaece
   * o card e o backend nega o checkout. Planos ativos não declaram o campo.
   */
  disponivel?: boolean
}

/** Helper: o plano atual é bronze, prata ou ouro? */
export const planoAbaixoDe = (plan: UserPlan, minimo: UserPlan): boolean => {
  const ordem: UserPlan[] = ['basico', 'bronze', 'prata', 'ouro']
  return ordem.indexOf(plan) < ordem.indexOf(minimo)
}

export const PLANOS: PlanoConfig[] = [
  {
    id: 'basico',
    name: 'Básico',
    tagline: 'O essencial para suas finanças',
    price: 'Grátis',
    color: 'border-gray-200 bg-white',
    features: [
      { title: 'Controle de receitas e despesas', included: true },
      { title: 'Cartões de crédito com controle de fatura', included: true },
      { title: 'Categorias e gráfico de donut animado', included: true },
      { title: 'Extrato do mês atual e passados', included: true },
      {
        title: 'Grupos compartilhados de despesas: divida lançamentos com família e amigos',
        included: true,
      },
      {
        title: 'Divisão por membro, com quem pagou e valores por pessoa',
        included: true,
      },
      { title: 'Despesas recorrentes fixas', included: false, reason: 'A partir do Bronze' },
      {
        title: 'Extrato e previsão de meses futuros',
        included: false,
        reason: 'A partir do Bronze',
      },
      {
        title: 'Módulo de Imóveis na planta (INCC)',
        included: false,
        reason: 'Exclusivo do Ouro',
      },
    ],
  },
  {
    id: 'bronze',
    name: 'Bronze',
    tagline: 'Previsibilidade e despesas recorrentes',
    price: 'R$ 14,99',
    period: '/mês',
    popular: true,
    color: 'border-[#6639A6] bg-purple-50/40 shadow-md',
    features: [
      { title: 'Tudo incluso no plano Básico', included: true },
      { title: 'Despesas e receitas recorrentes automáticas', included: true },
      { title: 'Visualização de extratos de meses futuros', included: true },
      { title: 'Previsão de fluxo de caixa', included: true },
      {
        title: 'Módulo de Imóveis na planta (INCC)',
        included: false,
        reason: 'Exclusivo do Ouro',
      },
    ],
  },
  {
    id: 'prata',
    name: 'Prata',
    tagline: 'Lance tudo pelo WhatsApp, sem abrir o app',
    price: 'R$ 24,99',
    period: '/mês',
    color: 'border-slate-400 bg-gradient-to-b from-slate-50/60 to-white shadow-md',
    disponivel: false,
    features: [
      { title: 'Tudo incluso nos planos Básico e Bronze', included: true },
      {
        title: 'Lançamentos pelo WhatsApp: "gastei 50 no uber" e pronto',
        included: true,
      },
      {
        title: 'Despesas em cartão, parceladas, recorrentes e receitas por mensagem',
        included: true,
      },
      {
        title: 'O bot pergunta o que falta (cartão, entrada ou saída) antes de gravar',
        included: true,
      },
      {
        title: 'Módulo de Imóveis na planta (INCC)',
        included: false,
        reason: 'Exclusivo do Ouro',
      },
    ],
  },
  {
    id: 'ouro',
    name: 'Ouro',
    tagline: 'Controle total com imóveis na planta',
    price: 'R$ 29,99',
    period: '/mês',
    color: 'border-amber-400 bg-gradient-to-b from-amber-50/50 to-white shadow-lg',
    features: [
      { title: 'Tudo incluso nos planos Básico e Bronze', included: true },
      { title: 'Módulo exclusivo de Imóveis na planta', included: true },
      { title: 'Correção pelo INCC oficial do Banco Central (SGS 192)', included: true },
      { title: 'Cálculo de defasagem e mês-base contratual', included: true },
      { title: 'Fluxo de pagamento, parcelas e saldo a pagar por imóvel', included: true },
      { title: 'Prioridade em novos recursos do Quitafy', included: true },
    ],
  },
]
