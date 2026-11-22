/**
 * Exportação do Extrato em PDF (cliente, jsPDF).
 *
 * O PDF espelha o que a tela /extrato mostra para o mês navegado:
 * cabeçalho com logo, mês/ano de referência, card de Entradas (linhas +
 * total), card de Saídas (linhas individuais + linha consolidada de Cartões
 * quando houver + total), o valor de Restante/Economia e o resumo por
 * categoria (incluindo "Economia" quando positiva).
 */
import { jsPDF } from 'jspdf'
import type { Transacao } from '@/types/financial'
import { formatBRLPublic } from '@/lib/format'
import appIcon from '@/assets/logo-192-8a6a4.png'

const PRIMARY: [number, number, number] = [102, 57, 166] // #6639A6
const PRIMARY_DARK: [number, number, number] = [74, 31, 122] // #4A1F7A
const TEXT_DARK: [number, number, number] = [31, 20, 56] // #1F1438
const TEXT_MUTED: [number, number, number] = [82, 103, 143]
const GREEN: [number, number, number] = [0, 117, 5] // --finz-green
const RED: [number, number, number] = [178, 0, 0] // --finz-red
const BLUE: [number, number, number] = [0, 101, 193] // --finz-blue (totais)
const BORDER: [number, number, number] = [228, 218, 243] // #E4DAF3

export interface ExtractPdfData {
  monthLabel: string // ex.: "novembro de 2025"
  receitas: Transacao[]
  despesasSemCartao: Transacao[]
  despesasCartao: Transacao[]
  nomeCartaoConsolidado: string
  totalCartoes: number
  totalReceitas: number
  totalDespesas: number
  economia: number
  categorias: { label: string; value: number }[]
}

const PAGE_MARGIN = 14
const CONTENT_WIDTH = 210 - PAGE_MARGIN * 2

/**
 * Sinal de valor que o jsPDF desenha sem substituir o glifo: o hífen-minus
 * (U+002D) existe na fonte Helvetica padrão; o "−" (U+2212) não existe e vira
 * um caractere estranho no PDF gerado — por isso aqui é sempre '-'.
 */
const SINAL_PDF = '-'

const loadLogo = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })

/** Linha fina de separação entre seções do PDF. */
function linha(doc: jsPDF, y: number): number {
  doc.setDrawColor(...BORDER)
  doc.setLineWidth(0.4)
  doc.line(PAGE_MARGIN, y, PAGE_MARGIN + CONTENT_WIDTH, y)
  return y + 7
}

/** Cabeçalho de seção (ex.: "Entradas do mês"). */
function tituloSecao(doc: jsPDF, texto: string, y: number): number {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...PRIMARY_DARK)
  doc.text(texto, PAGE_MARGIN, y)
  return y + 4
}

/**
 * Valor monetário alinhado à direita na borda do conteúdo, em UMA chamada
 * doc.text (sinal + valor juntos, sem quebra de linha) e reservando um limite
 * de largura para o texto da descrição nunca encostar nele.
 */
function desenharValor(
  doc: jsPDF,
  valor: number,
  y: number,
  cor: [number, number, number],
  sinal: '+' | '-' | null,
  bold = false,
): void {
  const texto = `${sinal ? `${sinal} ` : ''}${formatBRLPublic(valor)}`
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...cor)
  doc.text(texto, PAGE_MARGIN + CONTENT_WIDTH, y, { align: 'right', maxWidth: 60 })
}

/**
 * Lista de lançamentos + total, fiel ao card da tela: cada linha nome à
 * esquerda, sinal + valor à direita, total destacado no fim.
 */
function secaoLancamentos(
  doc: jsPDF,
  titulo: string,
  itens: { descricao: string; valor: number }[],
  total: number,
  negativo: boolean,
  yInicial: number,
): number {
  let y = tituloSecao(doc, titulo, yInicial)
  y = linha(doc, y)

  if (itens.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(156, 163, 175)
    doc.text('Nada registrado neste mês.', PAGE_MARGIN, y)
    y += 8
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (const item of itens) {
      doc.setTextColor(...TEXT_DARK)
      doc.text(String(item.descricao), PAGE_MARGIN, y, { maxWidth: CONTENT_WIDTH - 70 })
      desenharValor(doc, item.valor, y, negativo ? RED : GREEN, negativo ? SINAL_PDF : '+')
      y += 7
      if (y > 275) {
        doc.addPage()
        y = 20
      }
    }
    y = linha(doc, y)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TEXT_MUTED)
  doc.text('Total', PAGE_MARGIN, y)
  desenharValor(doc, total, y, BLUE, null, true)
  return y + 12
}

/**
 * Gera o PDF do extrato e dispara o download (desktop) / abertura no
 * visualizador (mobile). Nome do arquivo: quitafy-extrato-YYYY-MM.pdf.
 */
export async function exportarExtratoPdf(dados: ExtractPdfData, mesIso: string): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const centerX = pageWidth / 2

  // ---- Cabeçalho roxo (como o header do app) ----
  doc.setFillColor(...PRIMARY)
  doc.rect(0, 0, pageWidth, 26, 'F')

  // Logo + "Quitafy" como um bloco único centrado (gap de 2.5mm entre eles),
  // mesmo visual do header do app — sem espaço grande demais no meio.
  try {
    const img = await loadLogo(appIcon)
    const lado = 9
    const gap = 2.5
    const texto = 'Quitafy'
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    const larguraTexto = doc.getTextWidth(texto)
    const larguraBloco = lado + gap + larguraTexto
    const inicioBloco = centerX - larguraBloco / 2
    const meioFaixa = 26 / 2
    doc.addImage(img, 'PNG', inicioBloco, meioFaixa - lado / 2, lado, lado)
    doc.setTextColor(255, 255, 255)
    doc.text(texto, inicioBloco + lado + gap, meioFaixa, { baseline: 'middle' })
  } catch {
    // Sem logo, texto centrado puro (fallback idêntico ao header do app)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(255, 255, 255)
    doc.text('Quitafy', centerX, 26 / 2, { align: 'center', baseline: 'middle' })
  }

  // ---- Mês de referência ----
  let y = 36
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...PRIMARY_DARK)
  doc.text(`Extrato — ${dados.monthLabel}`, centerX, y, { align: 'center' })
  y += 9

  y = secaoLancamentos(
    doc,
    'Entradas do mês',
    dados.receitas.map((t) => ({ descricao: t.descricao, valor: t.valor })),
    dados.totalReceitas,
    false,
    y,
  )

  // Saídas: individuais (sem cartão) + linha consolidada de Cartões
  const saidas = [
    ...dados.despesasSemCartao.map((t) => ({ descricao: t.descricao, valor: t.valor })),
    ...(dados.despesasCartao.length > 0
      ? [
          {
            descricao:
              dados.despesasCartao.length > 1
                ? `${dados.nomeCartaoConsolidado} (${dados.despesasCartao.length} lançamentos)`
                : dados.nomeCartaoConsolidado,
            valor: dados.totalCartoes,
          },
        ]
      : []),
  ]
  y = secaoLancamentos(doc, 'Saídas do mês', saidas, dados.totalDespesas, true, y)

  // ---- Restante / Economia ----
  const positivo = dados.economia > 0
  const neutro = dados.economia === 0
  doc.setFillColor(...(neutro ? TEXT_MUTED : positivo ? GREEN : RED))
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 12, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text(
    neutro ? 'Restante/Economia' : positivo ? 'Economia' : 'Restante',
    PAGE_MARGIN + 4,
    y + 8,
  )
  desenharValor(
    doc,
    Math.abs(dados.economia),
    y + 8,
    [255, 255, 255],
    dados.economia === 0 ? null : dados.economia > 0 ? '+' : SINAL_PDF,
    true,
  )
  y += 18

  // ---- Resumo por categoria (só se houver categorias) ----
  if (dados.categorias.length > 0) {
    y = tituloSecao(doc, 'Gastos por Categoria', y)
    y = linha(doc, y)
    const totalCat = dados.categorias.reduce((acc, c) => acc + c.value, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    for (const c of dados.categorias) {
      const pct = totalCat > 0 ? Math.round((c.value / totalCat) * 100) : 0
      doc.setTextColor(...TEXT_DARK)
      doc.text(c.label, PAGE_MARGIN, y, { maxWidth: CONTENT_WIDTH - 80 })
      doc.setTextColor(...TEXT_MUTED)
      doc.text(`${formatBRLPublic(c.value)}  ·  ${pct}%`, PAGE_MARGIN + CONTENT_WIDTH, y, {
        align: 'right',
        maxWidth: 60,
      })
      y += 6
      if (y > 275) {
        doc.addPage()
        y = 20
      }
    }
    y = linha(doc, y)
  }

  // ---- Rodapé: data de geração ----
  const geradoEm = new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(156, 163, 175)
  doc.text(`Gerado em ${geradoEm} pelo Quitafy`, centerX, 289, { align: 'center' })

  const nomeArquivo = `quitafy-extrato-${mesIso}.pdf`
  doc.save(nomeArquivo)
}
