// 0004: adiciona a coleção "cartoes" (nome + data de vencimento, SEM saldo) e
// migra o conceito de contas para um modelo de cartão único:
// - "cartoes": cartões de crédito do usuário (nome, dia do vencimento, cor)
// - "transacoes": ganha o campo opcional "cartao_id" e passa a dispensar "conta_id"
//
// Segurança de dados: as transações existentes referenciam "contas" (Nubank,
// Carteira, Black, ...). Para não perder histórico, os vínculos são migrados:
// contas do tipo "cartao" viram registros em "cartoes"; as demais (carteira/
// banco) viram um único cartão-padrão "Conta Principal". Nada é apagado.
//
// Idempotente: cada passo só roda se o campo/coleção ainda não existir.

migrate(
  (app) => {
    const db = app.db()

    // ------------------------------------------------------------------
    // 1. Coleção "cartoes"
    // ------------------------------------------------------------------
    let cartoesCol
    try {
      cartoesCol = app.findCollectionByNameOrId('cartoes')
    } catch (_) {
      cartoesCol = null
    }

    if (!cartoesCol) {
      cartoesCol = new Collection({
        name: 'cartoes',
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
          { name: 'nome', type: 'text', required: true, min: 1, max: 60 },
          // Dia do mês (1-31) em que o vencimento da fatura fecha.
          // Compras feitas no dia do vencimento ou depois entram na fatura do mês seguinte.
          {
            name: 'dia_vencimento',
            type: 'number',
            required: true,
            min: 1,
            max: 31,
            onlyInt: true,
          },
          { name: 'cor', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_cartoes_user ON cartoes (user_id)'],
      })
      app.save(cartoesCol)
    }

    // ------------------------------------------------------------------
    // 2. transacoes: adiciona "cartao_id" e torna "conta_id" opcional
    // ------------------------------------------------------------------
    const txCol = app.findCollectionByNameOrId('transacoes')
    if (!txCol.fields.getByName('cartao_id')) {
      txCol.fields.add(
        new RelationField({
          name: 'cartao_id',
          collectionId: app.findCollectionByNameOrId('cartoes').id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(txCol)
    }

    const contaField = txCol.fields.getByName('conta_id')
    if (contaField && contaField.required) {
      contaField.required = false
      app.save(txCol)
    }

    // ------------------------------------------------------------------
    // 3. Migração de dados: contas -> cartoes (preserva o histórico)
    // ------------------------------------------------------------------
    // Garante que todo usuário com transações tenha pelo menos um cartão.
    const contasCol = app.findCollectionByNameOrId('contas')

    const cartoesPorConta = {} // contaId -> cartaoId
    const cartoesPorUsuario = {} // userId -> primeiro cartaoId criado

    const registrarCartao = (userId, cartaoId) => {
      if (!cartoesPorUsuario[userId]) cartoesPorUsuario[userId] = cartaoId
    }

    const findOrCreateCartao = (userId, nome, diaVencimento, cor) => {
      const existing = app.findRecordsByFilter(
        'cartoes',
        `user_id = '${userId}' && nome = '${String(nome).replace(/'/g, "''")}'`,
        'created',
        1,
        0,
      )
      if (existing.length > 0) {
        registrarCartao(userId, existing[0].id)
        return existing[0].id
      }
      const rec = new Record(cartoesCol)
      rec.set('user_id', userId)
      rec.set('nome', nome)
      rec.set('dia_vencimento', diaVencimento)
      rec.set('cor', cor || '#6639A6')
      app.save(rec)
      registrarCartao(userId, rec.id)
      return rec.id
    }

    // 3a. Contas do tipo "cartao" viram cartões de verdade
    const contasCartao = app.findRecordsByFilter('contas', 'tipo = "cartao"', 'created', 0, 0)
    contasCartao.forEach((conta) => {
      const userId = conta.getString('user_id')
      const cartaoId = findOrCreateCartao(
        userId,
        conta.getString('nome'),
        10, // vencimento padrão; o usuário ajusta depois na tela de Cartões
        conta.getString('cor'),
      )
      cartoesPorConta[conta.id] = cartaoId
    })

    // 3b. Transações: preenche "cartao_id" a partir da conta antiga
    const txRecords = app.findRecordsByFilter('transacoes', '', 'created', 0, 0)
    txRecords.forEach((tx) => {
      if (tx.getString('cartao_id')) return // já migrado
      const contaId = tx.getString('conta_id')
      let cartaoId = contaId ? cartoesPorConta[contaId] : null
      if (!cartaoId && contaId) {
        // conta não-do-tipo-cartão (carteira/banco): vira o "Conta Principal"
        try {
          const conta = app.findRecordById('contas', contaId)
          const userId = conta.getString('user_id')
          const cor = conta.getString('cor')
          cartaoId = findOrCreateCartao(userId, 'Conta Principal', 10, cor)
        } catch (_) {
          cartaoId = null
        }
      }
      if (cartaoId) {
        tx.set('cartao_id', cartaoId)
        app.save(tx)
      }
    })

    // 3c. Usuários com transações órfãs (sem conta): cria cartão padrão
    txRecords.forEach((tx) => {
      if (tx.getString('cartao_id')) return
      const userId = tx.getString('user_id')
      const cartaoId = findOrCreateCartao(userId, 'Conta Principal', 10, '#6639A6')
      tx.set('cartao_id', cartaoId)
      app.save(tx)
    })

    // Silencia lint para variáveis usadas acima
    void db
    void contasCol
  },
  (app) => {
    // down: remove o campo/coleção criados (best-effort)
    try {
      const txCol = app.findCollectionByNameOrId('transacoes')
      const f = txCol.fields.getByName('cartao_id')
      if (f) txCol.fields.removeByName('cartao_id')
      app.save(txCol)
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('cartoes')
      app.delete(col)
    } catch (_) {}
  },
)
