import type { UserPlan } from '@/types/financial'

/**
 * Configuração única dos planos do Quitafy, usada pela tela de Planos,
 * pelo texto do template de boas-vindas do WhatsApp (hook de cadastro) e
 * por qualquer surface futura.
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
}

export const PLANOS: PlanoConfig[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'O essencial para suas finanças',
    price: 'Grátis',
    color: 'border-gray-200 bg-white',
    features: [
      { title: 'Controle de receitas e despesas', included: true },
      { title: 'Cartões de crédito com controle de fatura', included: true },
      { title: 'Categorias e gráfico de donut animado', included: true },
      { title: 'Extrato do mês atual e passados', included: true },
      { title: 'Despesas recorrentes fixas', included: false, reason: 'Apenas VIP e Premium' },
      {
        title: 'Extrato e previsão de meses futuros',
        included: false,
        reason: 'Apenas VIP e Premium',
      },
      {
        title: 'Módulo de Imóveis na planta (INCC)',
        included: false,
        reason: 'Exclusivo do Premium',
      },
      { title: 'Interação pelo WhatsApp', included: false, reason: 'Exclusivo do Premium' },
    ],
  },
  {
    id: 'vip',
    name: 'VIP',
    tagline: 'Previsibilidade e despesas recorrentes',
    price: 'R$ 14,99',
    period: '/mês',
    popular: true,
    color: 'border-[#6639A6] bg-purple-50/40 shadow-md',
    features: [
      { title: 'Tudo incluso no plano Free', included: true },
      { title: 'Despesas e receitas recorrentes automáticas', included: true },
      { title: 'Visualização de extratos de meses futuros', included: true },
      { title: 'Previsão de fluxo de caixa', included: true },
      {
        title: 'Módulo de Imóveis na planta (INCC)',
        included: false,
        reason: 'Exclusivo do Premium',
      },
      { title: 'Interação pelo WhatsApp', included: false, reason: 'Exclusivo do Premium' },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Controle total com imóveis e WhatsApp',
    price: 'R$ 29,90',
    period: '/mês',
    color: 'border-amber-400 bg-gradient-to-b from-amber-50/50 to-white shadow-lg',
    features: [
      { title: 'Tudo incluso nos planos Free e VIP', included: true },
      { title: 'Módulo exclusivo de Imóveis na planta', included: true },
      { title: 'Correção pelo INCC oficial do Banco Central (SGS 192)', included: true },
      { title: 'Cálculo de defasagem e mês-base contratual', included: true },
      {
        title: 'Interação pelo WhatsApp: lance despesas e entradas mandando mensagem',
        included: true,
      },
      { title: 'Prioridade em novos recursos do Quitafy', included: true },
    ],
  },
]
