import type { UserPlan } from '@/types/financial'
import { planoAbaixoDe } from '@/lib/planos'

/**
 * Fonte única do conteúdo do Tutorial/Guia do Quitafy (mesmo padrão de
 * planos.ts): cada seção tem um plano mínimo exigido e é exibida quando o
 * plano do usuário é igual ou superior a ele.
 *
 * Hierarquia (cada plano inclui tudo do anterior):
 *   Básico (grátis) → Bronze R$ 14,99 → Prata R$ 24,99 → Ouro R$ 29,99
 *
 * Usado por: página /tutorial, tela de boas-vindas (só seções Básico) e
 * e-mail de boas-vindas (só seções Básico). Nunca duplicar este texto em
 * outra surface.
 */

export interface SecaoTutorial {
  id: string
  /** Plano mínimo exigido para a seção aparecer. */
  planoMinimo: UserPlan
  titulo: string
  descricao: string
  /** Passos curtos, um por linha — exibidos como lista numerada. */
  itens: string[]
}

export const SECOES_TUTORIAL: SecaoTutorial[] = [
  // ---------------- Básico ----------------
  {
    id: 'instalar',
    planoMinimo: 'basico',
    titulo: 'Instale o Quitafy na tela inicial do celular',
    descricao:
      'O Quitafy funciona como um app: instale-o na tela inicial e abra com um toque, sem digitar endereço.',
    itens: [
      'Android (Chrome): toque no menu ⋮ do navegador, toque em "Adicionar à tela inicial" e confirme em "Instalar" ou "Adicionar".',
      'iPhone/iPad (Safari): toque no botão de compartilhar (o quadrado com seta para cima), toque em "Adicionar à Tela de Início" e confirme em "Adicionar".',
      'Pronto: o ícone do Quitafy aparece junto dos seus apps e abre em tela cheia, como qualquer aplicativo.',
    ],
  },
  {
    id: 'inicio',
    planoMinimo: 'basico',
    titulo: 'Início — seu resumo do mês',
    descricao: 'A primeira tela depois do login mostra tudo o que importa de relance.',
    itens: [
      'O cartão roxo no topo traz o saldo do mês: receitas, despesas e o resultado.',
      'O gráfico de donut mostra quanto você gastou em cada categoria; toque numa fatia para ver os lançamentos daquela categoria.',
      'Os cartões abaixo listam os gastos principais do mês, com valor e porcentagem.',
      'Use a barra inferior (Início, Extrato, +, Cartões, Grupos) para navegar entre as telas.',
    ],
  },
  {
    id: 'nova-transacao',
    planoMinimo: 'basico',
    titulo: 'Nova transação — registre receitas e despesas',
    descricao:
      'O botão "+" da barra inferior abre o formulário para lançar qualquer entrada ou saída.',
    itens: [
      'Escolha se é entrada (receita) ou saída (despesa) e digite o valor.',
      'Selecione a categoria (moradia, alimentação, transporte...) e a data.',
      'Em "Mais detalhes" você pode vincular a um cartão de crédito ou dividir a despesa num grupo compartilhado.',
      'Toque em "Salvar" — o lançamento aparece na hora no Início e no Extrato.',
    ],
  },
  {
    id: 'extrato',
    planoMinimo: 'basico',
    titulo: 'Extrato — todo o histórico mês a mês',
    descricao: 'O Extrato reúne todos os lançamentos organizados por mês.',
    itens: [
      'Navegue entre os meses com as setas; o resumo do topo muda junto.',
      'Use o filtro para ver só receitas, só despesas ou uma categoria específica.',
      'Toque num lançamento para editar ou excluir.',
      'No menu do mês você exporta o extrato em PDF para guardar ou enviar.',
      'Meses futuros (previsão de fluxo) são um recurso do plano Bronze.',
    ],
  },
  {
    id: 'cartoes',
    planoMinimo: 'basico',
    titulo: 'Cartões — controle de fatura',
    descricao: 'Cadastre seus cartões e acompanhe a fatura de cada um.',
    itens: [
      'Toque em "Cartões" na barra inferior e depois em "Adicionar cartão".',
      'Informe nome e dia de fechamento: compras feitas a partir desse dia caem na fatura do mês seguinte.',
      'Ao lançar uma despesa, escolha o cartão e a fatura dele é atualizada sozinha.',
      'Na tela do cartão você vê o total da fatura e cada compra que a compõe — e pode editar o cartão ou ajustar o fechamento do mês.',
    ],
  },
  {
    id: 'grupos',
    planoMinimo: 'basico',
    titulo: 'Grupos compartilhados — divida com quem vive com você',
    descricao:
      'Perfeito para casais, famílias e repúblicas: todos veem as mesmas despesas do grupo.',
    itens: [
      'Crie um grupo em "Grupos" e convide as pessoas por e-mail.',
      'Cada lançamento do grupo pode indicar quem pagou e como o valor é dividido entre os membros (igual, por valor ou por porcentagem).',
      'A tela do grupo resume o saldo de cada pessoa: quem deve e quem tem a receber.',
      'Os lançamentos do grupo também aparecem no Extrato de quem participou.',
    ],
  },
  {
    id: 'perfil',
    planoMinimo: 'basico',
    titulo: 'Perfil — sua conta, plano e contato',
    descricao: 'Tudo de conta fica no menu aberto pela sua foto, no topo da tela.',
    itens: [
      'Toque na sua foto no header para abrir o menu do perfil.',
      '"Editar perfil" permite mudar nome, telefone e foto.',
      '"Tutorial" abre este guia, sempre atualizado com o seu plano.',
      '"Planos" mostra o que cada plano inclui e os preços.',
      '"Contato" abre o WhatsApp do suporte (quando disponível) e "Sair" encerra a sessão.',
    ],
  },
  // ---------------- Bronze ----------------
  {
    id: 'recorrentes',
    planoMinimo: 'bronze',
    titulo: 'Recorrentes — aluguel, assinaturas e salário (Bronze)',
    descricao:
      'Lançamentos que se repetem todo mês são criados uma vez e o Quitafy repete sozinho.',
    itens: [
      'Ao criar uma transação, marque "Recorrente" e escolha a frequência (mensal, semanal...).',
      'As parcelas futuras são geradas automaticamente: você não precisa lançar todo mês.',
      'No Extrato, as recorrentes já aparecem nos meses seguintes, montando sua previsão.',
      'Excluir uma recorrente remove a série inteira — para parar no mês atual, exclua a partir dele.',
    ],
  },
  {
    id: 'meses-futuros',
    planoMinimo: 'bronze',
    titulo: 'Extrato de meses futuros — veja o mês antes dele chegar (Bronze)',
    descricao:
      'Com recorrentes lançadas, o Extrato vira uma bola de cristal do seu fluxo de caixa.',
    itens: [
      'Avance os meses no Extrato para ver o saldo previsto de cada um.',
      'Lançamentos pontuais nos meses futuros também entram (contas a pagar, férias...).',
      'Use a previsão para decidir antes: dá pra assumir essa assinatura nova?',
    ],
  },
  // ---------------- Prata ----------------
  {
    id: 'whatsapp',
    planoMinimo: 'prata',
    titulo: 'Lançamentos pelo WhatsApp — lance sem abrir o app (Prata)',
    descricao: 'Manda uma mensagem e a despesa é gravada: o bot entende valor, categoria e cartão.',
    itens: [
      'Escreva do jeito que você fala: "gastei 50 no uber", "paguei a faculdade 350" ou "recebi 1200 de freela".',
      'O bot confirma o que entendeu e pergunta o que falta antes de gravar (cartão, entrada ou saída).',
      'Funciona com despesas simples, em cartão, parceladas e recorrentes — e também com receitas.',
      'O número do WhatsApp do Quitafy fica no menu do Usuário, clicando no seu icone e no item "Contato".',
    ],
  },
  // ---------------- Ouro ----------------
  {
    id: 'imoveis',
    planoMinimo: 'ouro',
    titulo: 'Imóveis na planta — acompanhe o INCC (Ouro)',
    descricao:
      'Para quem está comprando imóvel na planta: veja quanto o valor já subiu e o que falta pagar.',
    itens: [
      'Em "Imóveis" (aparece no menu para o plano Ouro) toque em "Adicionar imóvel".',
      'Informe valor total, data do contrato e mês-base: o Quitafy busca o INCC oficial do Banco Central e calcula a correção.',
      'Crie o fluxo de pagamento com entrada e parcelas; cada parcela mostra o valor corrigido.',
      'O resumo do imóvel mostra total corrigido, defasagem e saldo a pagar — sempre atualizado.',
    ],
  },
]

/** Seções do tutorial visíveis para o plano informado (inclui as dos planos anteriores). */
export function secoesDoPlano(plan: UserPlan | undefined): SecaoTutorial[] {
  const plano = plan || 'basico'
  return SECOES_TUTORIAL.filter((s) => !planoAbaixoDe(plano, s.planoMinimo))
}

/** Só as seções do plano Básico — usado na tela e no e-mail de boas-vindas. */
export function secoesBasicas(): SecaoTutorial[] {
  return SECOES_TUTORIAL.filter((s) => s.planoMinimo === 'basico')
}
