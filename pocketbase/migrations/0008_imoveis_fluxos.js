// Adiciona "fluxos" de pagamento de um imóvel (entrada, sinal, mensais,
// anual e financiamento), cada um com N parcelas corrigíveis pelo INCC.
// Também cria o imóvel + fluxos de exemplo do usuário (Well Home - Living).
migrate(
  (app) => {
    const imoveisCol = app.findCollectionByNameOrId('imoveis')

    // Campos novos em `imoveis`
    if (!imoveisCol.fields.getByName('data_chaves')) {
      imoveisCol.fields.add(new DateField({ name: 'data_chaves' }))
    }
    if (!imoveisCol.fields.getByName('data_financiamento')) {
      imoveisCol.fields.add(new DateField({ name: 'data_financiamento' }))
    }
    if (!imoveisCol.fields.getByName('defasagem_incc')) {
      imoveisCol.fields.add(
        new NumberField({ name: 'defasagem_incc', onlyInt: true, min: 0, max: 12 }),
      )
    }
    app.save(imoveisCol)

    // Nova coleção de fluxos (com regra própria — não depende de imovel_id)
    const fluxos = new Collection({
      name: 'imoveis_fluxos',
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
        {
          name: 'imovel_id',
          type: 'relation',
          required: true,
          collectionId: imoveisCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'nome', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['entrada', 'sinal', 'anual', 'mensal', 'financiamento'],
          maxSelect: 1,
        },
        { name: 'ordem', type: 'number', onlyInt: true },
        { name: 'valor_total', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_fluxos_imovel ON imoveis_fluxos (imovel_id)',
        'CREATE INDEX idx_fluxos_user ON imoveis_fluxos (user_id)',
      ],
    })
    app.save(fluxos)

    // Coleção de parcelas de um fluxo
    const parcelas = new Collection({
      name: 'imoveis_fluxo_parcelas',
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
        {
          name: 'fluxo_id',
          type: 'relation',
          required: true,
          collectionId: fluxos.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'numero', type: 'number', onlyInt: true },
        { name: 'valor_base', type: 'number', required: true },
        { name: 'vencimento', type: 'date', required: true },
        // "mes_base" é o mês (YYYY-MM) cujo INCC aplica nesta parcela,
        // já considerando a defasagem do imóvel.
        { name: 'mes_base', type: 'text' },
        {
          name: 'pago',
          type: 'bool',
        },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_fluxo_parcelas_fluxo ON imoveis_fluxo_parcelas (fluxo_id)',
        'CREATE INDEX idx_fluxo_parcelas_user ON imoveis_fluxo_parcelas (user_id)',
      ],
    })
    app.save(parcelas)

    // ── Seed de exemplo: Well Home - Living (Cyrela) ──
    const userId = 'thiago.dias.148116@gmail.com'
    const user = app.findAuthRecordByEmail('_pb_users_auth_', userId)

    // Idempotência: só semeia se o imóvel de exemplo não existir
    try {
      app.findFirstRecordByFilter(
        'imoveis',
        `user_id = '${user.id}' && nome = 'Well Home - Living'`,
      )
      return
    } catch (_) {}

    const imovel = new Record(imoveisCol)
    imovel.set('user_id', user.id)
    imovel.set('nome', 'Well Home - Living')
    imovel.set('construtora', 'Cyrela')
    imovel.set('valor_original', 865000)
    imovel.set('data_contrato', '2026-10-01 00:00:00.000Z')
    imovel.set('mes_base_incc', '2026-10')
    imovel.set('defasagem_incc', 2)
    imovel.set('defasagem_meses', 2)
    imovel.set('data_chaves', '2029-10-01 00:00:00.000Z')
    imovel.set('data_financiamento', '2029-09-01 00:00:00.000Z')
    imovel.set('data_entrega', '2029-10-01 00:00:00.000Z')
    imovel.set('observacoes', 'Entrada + sinal + mensais + financiamento, corrigidos pelo INCC.')
    app.save(imovel)

    const mk = (rec, col) => {
      const r = new Record(col)
      r.set('user_id', user.id)
      return r
    }

    const fluxoDefs = [
      {
        nome: 'Entrada',
        tipo: 'entrada',
        ordem: 1,
        valor_total: 10000,
        parcelas: 1,
        primeiro: '2026-10-01',
        valor: 10000,
      },
      {
        nome: 'Sinal',
        tipo: 'sinal',
        ordem: 2,
        valor_total: 10000,
        parcelas: 2,
        primeiro: '2027-01-01',
        valor: 5000,
      },
      {
        nome: 'Mensais',
        tipo: 'mensal',
        ordem: 3,
        valor_total: 62000,
        parcelas: 31,
        primeiro: '2027-03-01',
        valor: 2000,
      },
      {
        nome: 'Financiamento',
        tipo: 'financiamento',
        ordem: 4,
        valor_total: 30000,
        parcelas: 1,
        primeiro: '2029-10-01',
        valor: 30000,
      },
    ]

    for (const def of fluxoDefs) {
      const fluxoRec = new Record(fluxos)
      fluxoRec.set('user_id', user.id)
      fluxoRec.set('imovel_id', imovel.id)
      fluxoRec.set('nome', def.nome)
      fluxoRec.set('tipo', def.tipo)
      fluxoRec.set('ordem', def.ordem)
      fluxoRec.set('valor_total', def.valor_total)
      app.save(fluxoRec)

      for (let i = 0; i < def.parcelas; i++) {
        const d = new Date(def.primeiro + 'T12:00:00Z')
        d.setMonth(d.getMonth() + i)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        // Mês-base do INCC da parcela: dois meses antes do vencimento
        const ref = new Date(d.getFullYear(), d.getMonth() - 2, 1)
        const mesBase = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`
        const parcela = new Record(parcelas)
        parcela.set('user_id', user.id)
        parcela.set('fluxo_id', fluxoRec.id)
        parcela.set('numero', i + 1)
        parcela.set('valor_base', def.valor)
        parcela.set('vencimento', `${y}-${m}-01 12:00:00.000Z`)
        parcela.set('mes_base', mesBase)
        parcela.set('pago', false)
        app.save(parcela)
      }
    }
  },
  (app) => {
    // Revert: remove coleções novas e campos
    try {
      app.delete(app.findCollectionByNameOrId('imoveis_fluxo_parcelas'))
      app.delete(app.findCollectionByNameOrId('imoveis_fluxos'))
    } catch (_) {}
    try {
      const col = app.findCollectionByNameOrId('imoveis')
      for (const f of ['data_chaves', 'data_financiamento', 'defasagem_incc']) {
        const field = col.fields.getByName(f)
        if (field) col.fields.remove(field) // or similar API
      }
    } catch (_) {}
  },
)
