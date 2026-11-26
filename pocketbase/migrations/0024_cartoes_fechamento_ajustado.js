/**
 * Fechamento de cartão: renomeação de rótulo e ajuste pontual do mês.
 *
 * 1) O campo técnico `dia_vencimento` de `cartoes` é MANTIDO (nada de coluna
 *    nova nem backfill — dados existentes continuam intactos); só os textos
 *    da interface passam a dizer "fechamento".
 *
 * 2) `fechamento_ajustado` — ajuste PONTUAL de fechamento, vale só para UM
 *    mês (o atual, na prática). Guarda a data real do fechamento daquele mês
 *    (ex.: "2026-11-14 12:00:00.000Z"); vazio = sem ajuste. Bancos costumam
 *    antecipar/atrasar o fechamento quando o dia cai em fim de semana ou
 *    feriado — este campo registra isso sem alterar o dia padrão do cartão
 *    para os meses seguintes.
 */
migrate(
  (app) => {
    const cartoes = app.findCollectionByNameOrId('cartoes')
    if (!cartoes.fields.getByName('fechamento_ajustado')) {
      const f = new DateField({ name: 'fechamento_ajustado' })
      cartoes.fields.add(f)
    }
    app.save(cartoes)
  },
  (app) => {
    const cartoes = app.findCollectionByNameOrId('cartoes')
    if (cartoes.fields.getByName('fechamento_ajustado')) {
      cartoes.fields.removeByName('fechamento_ajustado')
    }
    app.save(cartoes)
  },
)
