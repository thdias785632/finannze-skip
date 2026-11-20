/** Formata um valor em Reais (padrão público, sem máscara de ocultar). */
export const formatBRLPublic = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
