// Compartilhamento de grupos: o membro convidado precisa LER o grupo em que
// participa (e os membros dele) — antes, só o dono via o grupo (regras
// list/view com user_id = @request.auth.id), e a convidada recebia 404 ao
// abrir /grupos.
//
// Novas regras:
//   - grupos: dono OU participante aceito (via back-relation
//     grupos_membros_via_grupo_id.user_id) OU convidado pendente (para o
//     convite aparecer na tela de Grupos mesmo antes de aceitar);
//   - grupos_membros: participante vê TODOS os membros do grupo (necessário
//     para divisão de despesas) — antes via só os próprios registros;
//   - transacoes/... permanecem como em 0010 (dono OU dividido_com).
migrate(
  (app) => {
    const grupos = app.findCollectionByNameOrId('grupos')
    const acessoGrupos =
      "@request.auth.id != '' && (user_id = @request.auth.id || grupos_membros_via_grupo_id.user_id = @request.auth.id)"
    grupos.listRule = acessoGrupos
    grupos.viewRule = acessoGrupos
    // update/delete seguem só do dono (nada muda).
    grupos.updateRule = "@request.auth.id != '' && user_id = @request.auth.id"
    grupos.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id"
    app.save(grupos)

    const membros = app.findCollectionByNameOrId('grupos_membros')
    // Participantes do grupo (dono ou membro, aceito ou pendente) veem todos
    // os registros de membros do grupo — sem isso a divisão não lista ninguém.
    const acessoMembros =
      "@request.auth.id != '' && (user_id = @request.auth.id || grupo_id.user_id = @request.auth.id || grupo_id.grupos_membros_via_grupo_id.user_id ?= @request.auth.id)"
    membros.listRule = acessoMembros
    membros.viewRule = acessoMembros
    app.save(membros)
  },
  (app) => {
    const grupos = app.findCollectionByNameOrId('grupos')
    grupos.listRule = "@request.auth.id != '' && user_id = @request.auth.id"
    grupos.viewRule = grupos.listRule
    app.save(grupos)
    const membros = app.findCollectionByNameOrId('grupos_membros')
    membros.listRule =
      "@request.auth.id != '' && (user_id = @request.auth.id || grupo_id.user_id = @request.auth.id)"
    membros.viewRule = membros.listRule
    app.save(membros)
  },
)
