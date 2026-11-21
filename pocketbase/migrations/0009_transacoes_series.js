/// <reference path="../pb_data/types.d.ts" />
/**
 * Série de parcelas em `transacoes`:
 *  - serie_id: texto compartilhado por todas as parcelas de uma mesma compra
 *    parcelada (vazio em lançamentos avulsos);
 *  - parcela_numero / parcela_total: posição e tamanho da série.
 * E backfill idempotente: séries criadas antes (convenção "Nome (2/6)",
 * gerada por createComParcelas) recebem serie_id derivado da primeira parcela.
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('transacoes')

    if (!col.fields.getByName('serie_id')) {
      col.fields.add(new TextField({ name: 'serie_id', max: 40 }))
    }
    if (!col.fields.getByName('parcela_numero')) {
      col.fields.add(new NumberField({ name: 'parcela_numero', onlyInt: true, min: 1, max: 24 }))
    }
    if (!col.fields.getByName('parcela_total')) {
      col.fields.add(new NumberField({ name: 'parcela_total', onlyInt: true, min: 1, max: 24 }))
    }
    app.save(col)

    // Backfill: para cada parcela "Nome (k/n)" sem serie_id, atribui o mesmo id
    // de série ("serie:<id da parcela 1>") às transações de mesmo user+cartão,
    // mesma base de nome e mesmo n. Rodar de novo não muda nada (idempotente).
    const pendentes = app.findRecordsByFilter(
      'transacoes',
      "serie_id = '' && descricao ~ '('",
      'created',
      0,
      0,
    )
    const grupos = new Map()
    for (const r of pendentes) {
      const m = r.getString('descricao').match(/^(.*) \((\d+)\/(\d+)\)$/)
      if (!m) continue
      const chave = `${r.getString('user_id')}|${r.getString('cartao_id')}|${m[3]}|${m[1]}`
      if (!grupos.has(chave)) grupos.set(chave, [])
      grupos.get(chave).push(r)
    }
    let series = 0
    for (const [, regs] of grupos) {
      const primeira = regs.reduce(
        (min, r) => (r.getString('data') < min.getString('data') ? r : min),
        regs[0],
      )
      const serieId = 'serie:' + primeira.id
      for (const r of regs) {
        const m = r.getString('descricao').match(/^(.*) \((\d+)\/(\d+)\)$/)
        r.set('serie_id', serieId)
        r.set('parcela_numero', Number(m[2]))
        r.set('parcela_total', Number(m[3]))
        app.save(r)
      }
      series++
    }
    console.log(`[0009] series de parcelas backfilladas: ${series}`)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('transacoes')
    for (const f of ['serie_id', 'parcela_numero', 'parcela_total']) {
      const fld = col.fields.getByName(f)
      if (fld) col.fields.removeByName(f)
    }
    app.save(col)
  },
)
