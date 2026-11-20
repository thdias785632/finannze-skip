migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const categoriasCol = app.findCollectionByNameOrId('categorias')
    const contasCol = app.findCollectionByNameOrId('contas')
    const transacoesCol = app.findCollectionByNameOrId('transacoes')
    const imoveisCol = app.findCollectionByNameOrId('imoveis')
    const indicesCol = app.findCollectionByNameOrId('indices_incc')

    // 1. Categorias padrão (user_id vazio = compartilhadas/padrão)
    const defaultCats = [
      { nome: 'Salário & Renda', cor: '#10B981', tipo: 'receita', icone: 'wallet' },
      {
        nome: 'Rendimentos & Investimentos',
        cor: '#06B6D4',
        tipo: 'receita',
        icone: 'trending-up',
      },
      { nome: 'Moradia & Contas', cor: '#8B5CF6', tipo: 'despesa', icone: 'home' },
      { nome: 'Alimentação & Supermercado', cor: '#F59E0B', tipo: 'despesa', icone: 'utensils' },
      { nome: 'Transporte & Combustível', cor: '#3B82F6', tipo: 'despesa', icone: 'car' },
      { nome: 'Saúde & Farmácia', cor: '#EF4444', tipo: 'despesa', icone: 'heart-pulse' },
      { nome: 'Lazer & Viagens', cor: '#EC4899', tipo: 'despesa', icone: 'smile' },
      { nome: 'Educação & Cursos', cor: '#6366F1', tipo: 'despesa', icone: 'book-open' },
      { nome: 'Compras & Pessoal', cor: '#14B8A6', tipo: 'despesa', icone: 'shopping-bag' },
      { nome: 'Outros', cor: '#64748B', tipo: 'despesa', icone: 'more-horizontal' },
    ]

    const catMap = {}
    for (const c of defaultCats) {
      try {
        const existing = app.findFirstRecordByFilter('categorias', `nome = '${c.nome}'`)
        catMap[c.nome] = existing.id
      } catch (_) {
        const rec = new Record(categoriasCol)
        rec.set('nome', c.nome)
        rec.set('cor', c.cor)
        rec.set('tipo', c.tipo)
        rec.set('icone', c.icone)
        app.save(rec)
        catMap[c.nome] = rec.id
      }
    }

    // 2. Histórico recente do INCC (2024 a fim de 2024 / dados reais da série SGS 192)
    const inccData = [
      { mes: '2024-01', data_referencia: '2024-01-01 00:00:00.000Z', variacao_mensal: 0.32 },
      { mes: '2024-02', data_referencia: '2024-02-01 00:00:00.000Z', variacao_mensal: 0.2 },
      { mes: '2024-03', data_referencia: '2024-03-01 00:00:00.000Z', variacao_mensal: 0.24 },
      { mes: '2024-04', data_referencia: '2024-04-01 00:00:00.000Z', variacao_mensal: 0.41 },
      { mes: '2024-05', data_referencia: '2024-05-01 00:00:00.000Z', variacao_mensal: 0.59 },
      { mes: '2024-06', data_referencia: '2024-06-01 00:00:00.000Z', variacao_mensal: 0.61 },
      { mes: '2024-07', data_referencia: '2024-07-01 00:00:00.000Z', variacao_mensal: 0.69 },
      { mes: '2024-08', data_referencia: '2024-08-01 00:00:00.000Z', variacao_mensal: 0.64 },
      { mes: '2024-09', data_referencia: '2024-09-01 00:00:00.000Z', variacao_mensal: 0.64 },
      { mes: '2024-10', data_referencia: '2024-10-01 00:00:00.000Z', variacao_mensal: 0.67 },
      { mes: '2024-11', data_referencia: '2024-11-01 00:00:00.000Z', variacao_mensal: 0.58 },
      { mes: '2024-12', data_referencia: '2024-12-01 00:00:00.000Z', variacao_mensal: 0.4 },
    ]

    for (const item of inccData) {
      try {
        app.findFirstRecordByFilter('indices_incc', `mes = '${item.mes}'`)
      } catch (_) {
        const rec = new Record(indicesCol)
        rec.set('mes', item.mes)
        rec.set('data_referencia', item.data_referencia)
        rec.set('variacao_mensal', item.variacao_mensal)
        rec.set('fonte', 'bcb_sgs_192')
        app.save(rec)
      }
    }

    // 3. Usuário de demonstração Thiago (plano premium para demonstrar tudo ativo)
    let userRecord
    try {
      userRecord = app.findAuthRecordByEmail('_pb_users_auth_', 'thiago.dias.148116@gmail.com')
      userRecord.set('plan', 'premium')
      app.save(userRecord)
    } catch (_) {
      userRecord = new Record(users)
      userRecord.setEmail('thiago.dias.148116@gmail.com')
      userRecord.setPassword('Skip@Pass')
      userRecord.setVerified(true)
      userRecord.set('name', 'Thiago Dias')
      userRecord.set('plan', 'premium')
      app.save(userRecord)
    }

    const userId = userRecord.id

    // 4. Contas de exemplo para o usuário
    const contasExemplo = [
      { nome: 'Conta Corrente Nubank', tipo: 'banco', saldo: 8450.75, cor: '#820AD1' },
      { nome: 'Carteira / Dinheiro', tipo: 'carteira', saldo: 420.0, cor: '#10B981' },
      { nome: 'Cartão de Crédito Black', tipo: 'cartao', saldo: -2340.5, cor: '#1E293B' },
    ]

    const contaMap = {}
    for (const c of contasExemplo) {
      try {
        const existing = app.findFirstRecordByFilter(
          'contas',
          `user_id = '${userId}' && nome = '${c.nome}'`,
        )
        contaMap[c.nome] = existing.id
      } catch (_) {
        const rec = new Record(contasCol)
        rec.set('user_id', userId)
        rec.set('nome', c.nome)
        rec.set('tipo', c.tipo)
        rec.set('saldo', c.saldo)
        rec.set('cor', c.cor)
        app.save(rec)
        contaMap[c.nome] = rec.id
      }
    }

    // 5. Transações de exemplo (mês corrente e recorrentes)
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0')
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 10)
    const nextYear = nextMonthDate.getFullYear()
    const nextMonth = String(nextMonthDate.getMonth() + 1).padStart(2, '0')

    const txSamples = [
      {
        descricao: 'Salário Mensal',
        valor: 12500.0,
        tipo: 'receita',
        data: `${currentYear}-${currentMonth}-05 10:00:00.000Z`,
        conta: contaMap['Conta Corrente Nubank'],
        cat: catMap['Salário & Renda'],
        recorrente: true,
        pago: true,
      },
      {
        descricao: 'Supermercado Pão de Açúcar',
        valor: 820.4,
        tipo: 'despesa',
        data: `${currentYear}-${currentMonth}-08 18:30:00.000Z`,
        conta: contaMap['Cartão de Crédito Black'],
        cat: catMap['Alimentação & Supermercado'],
        recorrente: false,
        pago: true,
      },
      {
        descricao: 'Aluguel & Condomínio',
        valor: 2600.0,
        tipo: 'despesa',
        data: `${currentYear}-${currentMonth}-10 09:00:00.000Z`,
        conta: contaMap['Conta Corrente Nubank'],
        cat: catMap['Moradia & Contas'],
        recorrente: true,
        pago: true,
      },
      {
        descricao: 'Combustível Posto Shell',
        valor: 280.0,
        tipo: 'despesa',
        data: `${currentYear}-${currentMonth}-14 15:20:00.000Z`,
        conta: contaMap['Cartão de Crédito Black'],
        cat: catMap['Transporte & Combustível'],
        recorrente: false,
        pago: true,
      },
      {
        descricao: 'Netflix + Spotify',
        valor: 89.8,
        tipo: 'despesa',
        data: `${currentYear}-${currentMonth}-15 08:00:00.000Z`,
        conta: contaMap['Cartão de Crédito Black'],
        cat: catMap['Lazer & Viagens'],
        recorrente: true,
        pago: true,
      },
      {
        descricao: 'Rendimento CDB 110% CDI',
        valor: 342.1,
        tipo: 'receita',
        data: `${currentYear}-${currentMonth}-18 11:00:00.000Z`,
        conta: contaMap['Conta Corrente Nubank'],
        cat: catMap['Rendimentos & Investimentos'],
        recorrente: false,
        pago: true,
      },
      // Transação futura do mês que vem (visível para VIP/Premium)
      {
        descricao: 'Salário Previsto (Próximo Mês)',
        valor: 12500.0,
        tipo: 'receita',
        data: `${nextYear}-${nextMonth}-05 10:00:00.000Z`,
        conta: contaMap['Conta Corrente Nubank'],
        cat: catMap['Salário & Renda'],
        recorrente: true,
        pago: false,
      },
      {
        descricao: 'Aluguel Previsto (Próximo Mês)',
        valor: 2600.0,
        tipo: 'despesa',
        data: `${nextYear}-${nextMonth}-10 09:00:00.000Z`,
        conta: contaMap['Conta Corrente Nubank'],
        cat: catMap['Moradia & Contas'],
        recorrente: true,
        pago: false,
      },
    ]

    for (const t of txSamples) {
      if (!t.conta) continue
      try {
        const existing = app.findFirstRecordByFilter(
          'transacoes',
          `user_id = '${userId}' && descricao = '${t.descricao}'`,
        )
      } catch (_) {
        const rec = new Record(transacoesCol)
        rec.set('user_id', userId)
        rec.set('descricao', t.descricao)
        rec.set('valor', t.valor)
        rec.set('tipo', t.tipo)
        rec.set('data', t.data)
        rec.set('conta_id', t.conta)
        if (t.cat) rec.set('categoria_id', t.cat)
        rec.set('recorrente', t.recorrente)
        rec.set('recorrencia_periodo', 'mensal')
        rec.set('pago', t.pago)
        app.save(rec)
      }
    }

    // 6. Imóvel de exemplo (na planta com correção INCC)
    try {
      app.findFirstRecordByFilter(
        'imoveis',
        `user_id = '${userId}' && nome = 'Residencial Bloom Apto 1204'`,
      )
    } catch (_) {
      const imovel = new Record(imoveisCol)
      imovel.set('user_id', userId)
      imovel.set('nome', 'Residencial Bloom Apto 1204')
      imovel.set('construtora', 'Even Construtora')
      imovel.set('valor_original', 580000.0)
      imovel.set('data_contrato', '2024-01-15 00:00:00.000Z')
      imovel.set('mes_base_incc', '2024-01')
      imovel.set('defasagem_meses', 2)
      imovel.set('data_entrega', '2027-06-30 00:00:00.000Z')
      imovel.set(
        'observacoes',
        'Contrato com correção mensal pelo INCC-M da FGV com defasagem de 2 meses.',
      )
      app.save(imovel)
    }
  },
  (app) => {
    // rollback idempotent
  },
)
