// Grupos compartilhados: fecha o ciclo do convidado.
//
// 1) ACEITAR CONVITE (causa raiz do "convidado não vê o grupo"): um convite
//    criado pelo dono com user_id = '' (pessoa ainda sem conta, ou cadastro
//    cujo hook de vínculo não rodou) não podia ser aceito pela própria
//    pessoa — a regra de update exigia user_id = eu OU ser dono do grupo,
//    e nenhuma valia para um convite não vinculado (403 ao aceitar; o
//    status nunca virava 'aceito' e o grupo nunca aparecia). Agora o
//    convidado pode aceitar/recusar um convite PENDENTE endereçado ao
//    próprio e-mail.
//
// 2) MEMBRO NÃO EDITA O QUE NÃO É DELE: update de transações passou a ser
//    só do autor (antes, quem estava em dividido_com podia editar o
//    lançamento do dono). Delete já era só do dono — mantido explícito.
//    A edição de proporções da divisão continua do autor (create/update de
//    transacoes_divisoes exige transacao_id.user_id = eu).
//
// 3) MESMA VISÃO DO DONO: o membro passa a VER também a categoria
//    (expansão) de um lançamento compartilhado com ele — antes a expand
//    caía fora das regras de categorias e o lançamento aparecia sem
//    categoria para o convidado.
migrate(
  (app) => {
    const transacoes = app.findCollectionByNameOrId('transacoes')
    transacoes.updateRule = "@request.auth.id != '' && user_id = @request.auth.id"
    transacoes.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id"
    app.save(transacoes)

    const membros = app.findCollectionByNameOrId('grupos_membros')
    const aceitarPendente = "(status = 'pendente' && user_id = '' && email = @request.auth.email)"
    membros.updateRule =
      "@request.auth.id != '' && (grupo_id.user_id = @request.auth.id || user_id = @request.auth.id || " +
      aceitarPendente +
      ')'
    membros.deleteRule =
      "@request.auth.id != '' && (grupo_id.user_id = @request.auth.id || user_id = @request.auth.id || " +
      aceitarPendente +
      ')'
    app.save(membros)

    const categorias = app.findCollectionByNameOrId('categorias')
    const acessoCategorias =
      "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id || transacoes_via_categoria_id.dividido_com.id ?= @request.auth.id)"
    categorias.listRule = acessoCategorias
    categorias.viewRule = acessoCategorias
    app.save(categorias)
  },
  (app) => {
    const transacoes = app.findCollectionByNameOrId('transacoes')
    transacoes.updateRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || dividido_com.id ?= @request.auth.id)"
    transacoes.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id"
    app.save(transacoes)

    const membros = app.findCollectionByNameOrId('grupos_membros')
    membros.updateRule =
      "@request.auth.id != '' && (grupo_id.user_id = @request.auth.id || user_id = @request.auth.id)"
    membros.deleteRule =
      "@request.auth.id != '' && (grupo_id.user_id = @request.auth.id || user_id = @request.auth.id)"
    app.save(membros)

    const categorias = app.findCollectionByNameOrId('categorias')
    categorias.listRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    categorias.viewRule = categorias.listRule
    app.save(categorias)
  },
)
