/**
 * 0020 — Privacidade das categorias do usuário.
 *
 * Regra do produto (pedido do dono): categorias criadas por um usuário são
 * PRIVADAS (visíveis/usáveis apenas por ele); as categorias default (user_id
 * vazio, semeadas na migração 0003) continuam visíveis para todos.
 *
 * A migração 0002 já deixava list/view com "(user_id = '' || user_id =
 * @request.auth.id)", mas o createRule aceitava qualquer corpo: um usuário
 * podia gravar uma categoria com user_id vazio (virava global para TODO
 * mundo) ou apontando para outra conta. Aqui as regras são reafirmadas de
 * forma idempotente e o create passa a EXIGIR que o dono seja o próprio
 * usuário autenticado. Sem mudança de estrutura — só API rules.
 */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('categorias')

    col.listRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.viewRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    // Toda categoria nova nasce do usuário autenticado — nunca global por engano.
    col.createRule = "@request.auth.id != '' && @request.body.user_id = @request.auth.id"
    // Só o dono edita ou exclui as suas; as default ficam intocáveis pelo app.
    col.updateRule = "@request.auth.id != '' && user_id = @request.auth.id"
    col.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id"

    app.save(col)
  },
  (app) => {
    // Rollback: volta às regras originais da migração 0002.
    const col = app.findCollectionByNameOrId('categorias')
    col.listRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.viewRule = "@request.auth.id != '' && (user_id = '' || user_id = @request.auth.id)"
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != '' && user_id = @request.auth.id"
    col.deleteRule = "@request.auth.id != '' && user_id = @request.auth.id"
    app.save(col)
  },
)
