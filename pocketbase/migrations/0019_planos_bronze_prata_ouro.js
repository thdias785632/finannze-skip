/**
 * Nova estrutura de planos do Quitafy: Básico (free) - Bronze - Prata - Ouro.
 *
 * - O campo `plan` dos usuários passa a aceitar basico/bronze/prata/ouro.
 * - Usuários existentes são migrados: free→basico, vip→bronze, premium→ouro
 *   (não existia equivalente do prata). Idempotente: em um banco vazio não há
 *   nada a migrar; em cópias restauradas, reexecutar não quebra.
 * - O valor antigo 'plano_insuficiente' do status de whatsapp_mensagens foi
 *   mantido (histórico de mensagens bloqueadas quando o plano era premium).
 */

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const field = users.fields.getByName('plan')

    // 1. Select passa a ter os novos valores (mantendo os antigos por seguranca,
    //    para que nenhuma linha fique orfa durante a transicao).
    const novos = ['basico', 'bronze', 'prata', 'ouro', 'free', 'vip', 'premium']
    if (field) {
      field.values = novos
      app.save(users)
    }

    // 2. Migra os registros existentes (idempotente).
    const mapa = { free: 'basico', vip: 'bronze', premium: 'ouro' }
    for (const [de, para] of Object.entries(mapa)) {
      app
        .db()
        .newQuery('UPDATE users SET plan = {:para} WHERE plan = {:de}')
        .bind({ de: de, para: para })
        .execute()
    }

    // 3. Deixa no select apenas os novos valores (as linhas ja foram migradas).
    const users2 = app.findCollectionByNameOrId('_pb_users_auth_')
    const field2 = users2.fields.getByName('plan')
    if (field2) {
      field2.values = ['basico', 'bronze', 'prata', 'ouro']
      app.save(users2)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const field = users.fields.getByName('plan')
    if (field) {
      field.values = ['free', 'vip', 'premium']
      app.save(users)
    }
    const mapaVolta = { basico: 'free', bronze: 'vip', ouro: 'premium', prata: 'vip' }
    for (const [de, para] of Object.entries(mapaVolta)) {
      app
        .db()
        .newQuery('UPDATE users SET plan = {:para} WHERE plan = {:de}')
        .bind({ de: de, para: para })
        .execute()
    }
  },
)
