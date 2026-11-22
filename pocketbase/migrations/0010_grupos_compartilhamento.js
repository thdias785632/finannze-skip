// Grupos compartilhados: grupos, membros (convite por e-mail), divisão do
// valor de transações por pessoa e vínculo de imóvel a vários usuários
// (permissão de VER E EDITAR para os membros).
//
// Regras de acesso por compartilhamento (PocketBase, sem joins profundos):
//   - transacoes: dono OU divisão que aponte para mim (transacoes_divisoes.user_id)
//   - imoveis: dono OU listado em compartilhado_com (relation multi → users)
migrate(
  (app) => {
    // ── grupos ──
    let grupos
    try {
      grupos = app.findCollectionByNameOrId('grupos')
    } catch (_) {
      grupos = new Collection({
        name: 'grupos',
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
          { name: 'created', type: 'autodate', onCreate: true },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_grupos_user ON grupos (user_id)'],
      })
      app.save(grupos)
    }

    // ── grupos_membros ──
    let membros
    try {
      membros = app.findCollectionByNameOrId('grupos_membros')
    } catch (_) {
      membros = new Collection({
        name: 'grupos_membros',
        type: 'base',
        // Lista: participantes do grupo (dono vê tudo; membro aceito vê o
        // próprio grupo) + convites pendentes endereçados a mim.
        listRule:
          "@request.auth.id != '' && (user_id = @request.auth.id || grupo_id.user_id = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && (user_id = @request.auth.id || grupo_id.user_id = @request.auth.id)",
        createRule: "@request.auth.id != '' && @request.body.grupo_id.user_id = @request.auth.id",
        updateRule:
          "@request.auth.id != '' && (grupo_id.user_id = @request.auth.id || user_id = @request.auth.id)",
        deleteRule:
          "@request.auth.id != '' && (grupo_id.user_id = @request.auth.id || user_id = @request.auth.id)",
        fields: [
          {
            name: 'grupo_id',
            type: 'relation',
            required: true,
            collectionId: grupos.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'user_id',
            type: 'relation',
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'email', type: 'text', required: true },
          { name: 'nome', type: 'text' },
          {
            name: 'papel',
            type: 'select',
            required: true,
            values: ['dono', 'membro'],
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['aceito', 'pendente'],
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_grupos_membros_grupo ON grupos_membros (grupo_id)',
          'CREATE INDEX idx_grupos_membros_user ON grupos_membros (user_id)',
        ],
      })
      app.save(membros)
    }

    // ── transacoes_divisoes ──
    let divisoes
    try {
      divisoes = app.findCollectionByNameOrId('transacoes_divisoes')
    } catch (_) {
      // coleção nova: guarda quanto do valor de cada transação vai para cada pessoa
      divisoes = new Collection({
        name: 'transacoes_divisoes',
        type: 'base',
        // Visível para o dono da transação e para o usuário dividido.
        listRule:
          "@request.auth.id != '' && (transacao_id.user_id = @request.auth.id || user_id = @request.auth.id)",
        viewRule:
          "@request.auth.id != '' && (transacao_id.user_id = @request.auth.id || user_id = @request.auth.id)",
        createRule:
          "@request.auth.id != '' && @request.body.transacao_id.user_id = @request.auth.id && @request.body.user_id != ''",
        // A divisão é gerida pelo dono da transação (ou pelo próprio dividido,
        // para se remover).
        updateRule:
          "@request.auth.id != '' && (transacao_id.user_id = @request.auth.id || user_id = @request.auth.id)",
        deleteRule:
          "@request.auth.id != '' && (transacao_id.user_id = @request.auth.id || user_id = @request.auth.id)",
        fields: [
          {
            name: 'transacao_id',
            type: 'relation',
            required: true,
            collectionId: app.findCollectionByNameOrId('transacoes').id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: '_pb_users_auth_',
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'valor', type: 'number', required: true },
          { name: 'created', type: 'autodate', onCreate: true },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_trans_divisoes_transacao ON transacoes_divisoes (transacao_id)',
          'CREATE UNIQUE INDEX idx_trans_divisoes_unica ON transacoes_divisoes (transacao_id, user_id)',
        ],
      })
      app.save(divisoes)
    }

    // ── imoveis.compartilhado_com ──
    const imoveis = app.findCollectionByNameOrId('imoveis')
    if (!imoveis.fields.getByName('compartilhado_com')) {
      imoveis.fields.add(
        new RelationField({
          name: 'compartilhado_com',
          collectionId: '_pb_users_auth_',
          maxSelect: 99,
          cascadeDelete: false,
        }),
      )
    }
    // Valor do imóvel deixa de ser obrigatório — nasce da soma dos fluxos.
    const valorField = imoveis.fields.getByName('valor_original')
    if (valorField && valorField.required) {
      valorField.required = false
    }
    imoveis.listRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || compartilhado_com.id ?= @request.auth.id)"
    imoveis.viewRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || compartilhado_com.id ?= @request.auth.id)"
    imoveis.createRule =
      "@request.auth.id != '' && @request.body.user_id = @request.auth.id && @request.body.compartilhado_com:length <= 50"
    imoveis.updateRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || compartilhado_com.id ?= @request.auth.id)"
    imoveis.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id"
    app.save(imoveis)

    // ── transacoes: campo dividido_com + regras de compartilhamento ──
    // (as regras usam um relation multi local, pois back-relations não são
    // aceitas na gramática de rules do PocketBase; a soma por pessoa fica
    // em transacoes_divisoes)
    const transacoes = app.findCollectionByNameOrId('transacoes')
    if (!transacoes.fields.getByName('dividido_com')) {
      transacoes.fields.add(
        new RelationField({
          name: 'dividido_com',
          collectionId: '_pb_users_auth_',
          maxSelect: 99,
          cascadeDelete: false,
        }),
      )
    }
    transacoes.listRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || dividido_com.id ?= @request.auth.id)"
    transacoes.viewRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || dividido_com.id ?= @request.auth.id)"
    transacoes.createRule = "@request.auth.id != '' && @request.body.user_id = @request.auth.id"
    transacoes.updateRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || dividido_com.id ?= @request.auth.id)"
    transacoes.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id"
    app.save(transacoes)

    // ── imoveis_fluxos / imoveis_fluxo_parcelas: membros do imóvel editam ──
    for (const nome of ['imoveis_fluxos', 'imoveis_fluxo_parcelas']) {
      const col = app.findCollectionByNameOrId(nome)
      // imoveis_fluxos: acesso via imovel_id; parcelas: via fluxo_id.imovel_id
      const caminho =
        nome === 'imoveis_fluxos'
          ? 'imovel_id.compartilhado_com.id'
          : 'fluxo_id.imovel_id.compartilhado_com.id'
      const acesso =
        "@request.auth.id != '' && (user_id = @request.auth.id || " +
        caminho +
        ' ?= @request.auth.id)'
      col.listRule = acesso
      col.viewRule = acesso
      col.updateRule = acesso
      col.deleteRule = acesso
      col.createRule =
        "@request.auth.id != '' && (@request.body.user_id = @request.auth.id" +
        (nome === 'imoveis_fluxos'
          ? ' || @request.body.imovel_id.compartilhado_com.id ?= @request.auth.id'
          : ' || @request.body.fluxo_id.imovel_id.compartilhado_com.id ?= @request.auth.id') +
        ')'
      app.save(col)
    }
  },
  (app) => {
    // Revert
    for (const nome of ['transacoes_divisoes', 'grupos_membros', 'grupos']) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {}
    }
    try {
      const imoveis = app.findCollectionByNameOrId('imoveis')
      const f = imoveis.fields.getByName('compartilhado_com')
      if (f) imoveis.fields.remove(f)
      imoveis.listRule = "@request.auth.id != '' && user_id = @request.auth.id"
      imoveis.viewRule = imoveis.listRule
      imoveis.createRule = "@request.auth.id != '' && @request.body.user_id = @request.auth.id"
      imoveis.updateRule = imoveis.listRule
      imoveis.deleteRule = imoveis.listRule
      const valorField = imoveis.fields.getByName('valor_original')
      if (valorField) valorField.required = true
      app.save(imoveis)
    } catch (_) {}
  },
)
