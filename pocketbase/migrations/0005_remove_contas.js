// 0005: remove o conceito de "contas" — o app passa a ter apenas cartões.
// Nesta altura (0004) todas as transações já têm "cartao_id" preenchido a
// partir da conta antiga, então o campo "conta_id" e a coleção "contas"
// (Nubank, Carteira, Black...) podem sair sem perder histórico.
//
// Idempotente: cada passo é ignorado se já foi aplicado.

migrate(
  (app) => {
    // 1. Remove o índice e o campo "conta_id" das transações
    try {
      const txCol = app.findCollectionByNameOrId('transacoes')
      let changed = false
      if (txCol.fields.getByName('conta_id')) {
        txCol.fields.removeByName('conta_id')
        changed = true
      }
      const idx = app.tableIndexes('transacoes')
      if (idx['idx_transacoes_conta']) {
        txCol.removeIndex('idx_transacoes_conta')
        changed = true
      }
      if (changed) app.save(txCol)
    } catch (_) {
      // coleção transacoes inexistente: nada a fazer
    }

    // 2. Apaga os registros de contas (dados antigos de exemplo)
    try {
      const contasCol = app.findCollectionByNameOrId('contas')
      const registros = app.findRecordsByFilter('contas', '', 'created', 0, 0)
      registros.forEach((r) => {
        try {
          app.delete(r)
        } catch (_) {}
      })
      app.delete(contasCol)
    } catch (_) {
      // coleção contas inexistente: nada a fazer
    }
  },
  (app) => {
    // down: recria a coleção "contas" vazia (best-effort; o histórico de contas
    // foi convertido em cartões e não volta)
    try {
      app.findCollectionByNameOrId('contas')
    } catch (_) {
      const col = new Collection({
        name: 'contas',
        type: 'base',
        listRule: "@request.auth.id != '' && user_id = @request.auth.id",
        viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
        createRule: "@request.auth.id != '' && @request.body.user_id = @request.auth.id",
        updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
        deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'nome', type: 'text', required: true },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['carteira', 'banco', 'cartao'],
            maxSelect: 1,
          },
          { name: 'saldo', type: 'number', required: true },
          { name: 'cor', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(col)
    }
  },
)
