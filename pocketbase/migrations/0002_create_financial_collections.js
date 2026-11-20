migrate(
  (app) => {
    // 1. Categorias
    const categorias = new Collection({
      name: 'categorias',
      type: 'base',
      listRule: "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)",
      viewRule: "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'cor', type: 'text', required: true },
        { name: 'tipo', type: 'select', values: ['receita', 'despesa', 'ambos'], maxSelect: 1 },
        { name: 'icone', type: 'text' },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_categorias_user ON categorias (user_id)'],
    })
    app.save(categorias)

    // 2. Contas
    const contas = new Collection({
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
      indexes: ['CREATE INDEX idx_contas_user ON contas (user_id)'],
    })
    app.save(contas)

    // 3. Transacoes
    const transacoes = new Collection({
      name: 'transacoes',
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
        { name: 'descricao', type: 'text', required: true },
        { name: 'valor', type: 'number', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['receita', 'despesa'],
          maxSelect: 1,
        },
        { name: 'data', type: 'date', required: true },
        {
          name: 'conta_id',
          type: 'relation',
          required: true,
          collectionId: contas.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'categoria_id', type: 'relation', collectionId: categorias.id, maxSelect: 1 },
        { name: 'recorrente', type: 'bool' },
        { name: 'recorrencia_periodo', type: 'select', values: ['mensal', 'anual'], maxSelect: 1 },
        { name: 'pago', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_transacoes_user_data ON transacoes (user_id, data DESC)',
        'CREATE INDEX idx_transacoes_conta ON transacoes (conta_id)',
      ],
    })
    app.save(transacoes)

    // 4. Imoveis
    const imoveis = new Collection({
      name: 'imoveis',
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
        { name: 'construtora', type: 'text' },
        { name: 'valor_original', type: 'number', required: true },
        { name: 'data_contrato', type: 'date' },
        { name: 'mes_base_incc', type: 'text', required: true }, // e.g. "2024-01"
        { name: 'defasagem_meses', type: 'number' }, // defasagem padrão: 2
        { name: 'data_entrega', type: 'date' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_imoveis_user ON imoveis (user_id)'],
    })
    app.save(imoveis)

    // 5. Indices INCC em cache/armazenados
    const indicesIncc = new Collection({
      name: 'indices_incc',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: null, // populado por hook/migração
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'mes', type: 'text', required: true }, // "YYYY-MM"
        { name: 'data_referencia', type: 'date', required: true },
        { name: 'variacao_mensal', type: 'number', required: true }, // ex: 0.35 para 0.35%
        { name: 'fonte', type: 'text' }, // "bcb_sgs_192" ou "manual"
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_indices_incc_mes ON indices_incc (mes)'],
    })
    app.save(indicesIncc)

    // 6. Parcelas / Fluxos de Imóveis (opcional detalhado para parcelamento)
    const imovelParcelas = new Collection({
      name: 'imovel_parcelas',
      type: 'base',
      listRule: "@request.auth.id != '' && imovel_id.user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && imovel_id.user_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && imovel_id.user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && imovel_id.user_id = @request.auth.id",
      fields: [
        {
          name: 'imovel_id',
          type: 'relation',
          required: true,
          collectionId: imoveis.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'descricao', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          values: ['entrada', 'mensal', 'intermediaria', 'chaves', 'financiamento', 'outro'],
          maxSelect: 1,
        },
        { name: 'valor_base', type: 'number', required: true },
        { name: 'vencimento', type: 'date', required: true },
        { name: 'aplica_incc', type: 'bool' },
        { name: 'pago', type: 'bool' },
        { name: 'valor_pago', type: 'number' },
        { name: 'data_pagamento', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_parcelas_imovel ON imovel_parcelas (imovel_id)'],
    })
    app.save(imovelParcelas)
  },
  (app) => {
    const toDelete = [
      'imovel_parcelas',
      'indices_incc',
      'imoveis',
      'transacoes',
      'contas',
      'categorias',
    ]
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
