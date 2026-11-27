/**
 * Telefone brasileiro com DDI — máscara de digitação e normalização.
 *
 * Fonte única usada pelo cadastro (AuthScreen) e pela edição de perfil: o valor
 * gravado no usuário sai SEMPRE "+DDDDDDNUMERO" (ex.: +554391141968), mesmo
 * formato que o webhook do WhatsApp usa para vincular o número à conta.
 */

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
export function formatarTelefoneBr(input: string): string {
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

/**
 * Máscara que aceita o valor já salvo (ex.: "+554391141968" ou "+55 (43) 91141-968")
 * e devolve a forma exibida com pontuação. Usada para pré-preencher o campo.
 * Cobre os dois tamanhos brasileiros: 13 dígitos (celular: 55 + DDD + 9 dígitos)
 * e 12 dígitos (fixo/antigo: 55 + DDD + 8 dígitos).
 */
export function exibirTelefone(entrada: string | undefined | null): string {
  if (!entrada) return ''
  if (/\D/.test(entrada)) return entrada // já tem pontuação: exibo como está
  const d = entrada.replace(/^\+/, '')
  let rest: string
  if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    rest = d.slice(2)
  } else if (d.length === 10 || d.length === 11) {
    // salvo sem DDI (não deveria acontecer): exibo mesmo assim como +55
    rest = d
  } else {
    return entrada
  }
  const ddd = rest.slice(0, 2)
  const num = rest.slice(2)
  const corpo =
    num.length > 8 ? `${num.slice(0, 5)}-${num.slice(5)}` : `${num.slice(0, 4)}-${num.slice(4)}`
  return `+55 (${ddd}) ${corpo}`
}
