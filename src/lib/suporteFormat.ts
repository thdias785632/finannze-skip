/** Formatação de timestamps para as telas de Ajuda e Atendimentos. */

/** "2026-11-27 14:03:22.094Z" (ou ISO) → "27/11 14:03". */
export function formatarHora(valor: string | undefined): string {
  if (!valor) return ''
  const d = new Date(valor.replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    ' ' +
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  )
}

/** Data/hora completa, para o detalhe: "27/11/2026 às 14:03". */
export function formatarHoraCompleta(valor: string | undefined): string {
  if (!valor) return ''
  const d = new Date(valor.replace(' ', 'T'))
  if (isNaN(d.getTime())) return ''
  return (
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear() +
    ' às ' +
    String(d.getHours()).padStart(2, '0') +
    ':' +
    String(d.getMinutes()).padStart(2, '0')
  )
}

/** Telefone só de dígitos → "+55 11 93216-6607" (melhor esforço). */
export function formatarTelefone(numero: string): string {
  const d = String(numero || '').replace(/\D/g, '')
  if (d.length < 10) return numero
  const ddi = d.startsWith('55') ? d.slice(0, 2) : ''
  const resto = ddi ? d.slice(2) : d
  const ddd = resto.slice(0, 2)
  const parte = resto.slice(2)
  const meio = parte.length > 8 ? parte.slice(0, 5) : parte.slice(0, 4)
  const fim = parte.length > 8 ? parte.slice(5) : parte.slice(4)
  return `+${ddi} ${ddd} ${meio}-${fim}`.replace(/\s+/g, ' ').trim()
}
