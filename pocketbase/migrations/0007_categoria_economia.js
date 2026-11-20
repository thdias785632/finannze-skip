// 0007: cria a categoria padrão "Economia" (user_id vazio = compartilhada).
// Ela não é lançada manualmente: no gráfico ela aparece como a diferença
// entre entradas e saídas do mês (calculada no cliente, em Dashboard/Extract).
//
// Idempotente: se já existe, nada muda.
migrate(
  (app) => {
    const categoriasCol = app.findCollectionByNameOrId('categorias')

    try {
      app.findFirstRecordByFilter('categorias', "nome = 'Economia'")
      return // já existe
    } catch (_) {
      const rec = new Record(categoriasCol)
      rec.set('nome', 'Economia')
      rec.set('cor', '#4C1D95')
      rec.set('tipo', 'despesa')
      rec.set('icone', 'piggy-bank')
      app.save(rec)
    }
  },
  (app) => {
    // down: nada a desfazer (dados)
  },
)
