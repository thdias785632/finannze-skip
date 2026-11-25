/**
 * Rota: POST /backend/v1/perfil/excluir
 *
 * Exclui a conta do usuário autenticado (token Bearer do PocketBase) e todos
 * os registros relacionados dele (transações, cartões, categorias, imóveis,
 * fluxos, parcelas, divisões, grupos, membros, pendências/contas WhatsApp),
 * em transação. Grupos compartilhados com outras pessoas continuam de pé:
 * apenas o membro correspondente é removido.
 *
 * Requer secret WHATSAPP_CONTATO_URL? Não — este hook não usa secrets.
 * O link de contato é lido por config_contato.pb.js (WHATSAPP_CONTATO_URL).
 */
routerAdd(
  'POST',
  '/backend/v1/perfil/excluir',
  (e) => {
    // Com $apis.requireAuth() no middleware, o auth do token já foi resolvido.
    const info = e.requestInfo()
    const userId = (info.auth && info.auth.id) || ''

    if (!userId) {
      return e.json(401, { error: 'Não autenticado.' })
    }

    const colecoesPorDono = [
      'transacoes_divisoes',
      'transacoes',
      'cartoes',
      'categorias',
      'imoveis_fluxo_parcelas',
      'imoveis_fluxos',
      'imoveis',
      'grupos_membros',
      'grupos',
      'whatsapp_contas',
      'whatsapp_mensagens',
      'whatsapp_pendencias',
    ]

    try {
      $app.runInTransaction((txApp) => {
        // Primeiro os filhos (divisões → transações → cartões, etc.), depois o user.
        for (const nome of colecoesPorDono) {
          let colecao = null
          try {
            colecao = txApp.findCollectionByNameOrId(nome)
          } catch {
            colecao = null // coleção não existe nesta instância: pula
          }
          if (!colecao) continue

          // Apaga registros onde o campo user (ou user_id) aponta para o usuário.
          for (const campo of ['user', 'user_id']) {
            const registros = txApp.findRecordsByFilter(colecao, `${campo} = {:uid}`, '', 0, 0, {
              uid: userId,
            })
            for (const reg of registros) {
              txApp.delete(reg)
            }
          }
        }

        // Por fim, apaga a própria conta (o authStore do front é limpo no cliente).
        const usuario = txApp.findRecordById('users', userId)
        txApp.delete(usuario)
      })
    } catch (err) {
      console.log('[perfil_excluir] falhou para', userId, err)
      return e.json(500, { error: 'Não foi possível excluir a conta. Tente novamente.' })
    }

    return e.json(200, { ok: true })
  },
  $apis.requireAuth(),
)
