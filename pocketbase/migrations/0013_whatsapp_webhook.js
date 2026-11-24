/**
 * Webhook do WhatsApp Business (Meta Cloud API).
 *
 * Cria duas coleções de apoio:
 *  - whatsapp_contas: mapeia um número de WhatsApp (só dígitos, com DDI,
 *    ex. 5511999998888) → usuário do app. Como transacoes.user_id é
 *    obrigatório, toda transação criada pelo webhook precisa de dono.
 *  - whatsapp_mensagens: log/deduplicação das mensagens recebidas da Meta
 *    (a Meta pode reenviar o mesmo wamid; o índice único evita despesa duplicada).
 */
migrate(
  (app) => {
    const usersId = '_pb_users_auth_'
    const transacoesId = app.findCollectionByNameOrId('transacoes').id

    const contas = new Collection({
      name: 'whatsapp_contas',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.body.user_id = @request.auth.id",
      updateRule: "@request.auth.id != '' && user_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user_id = @request.auth.id",
      fields: [
        { name: 'numero', type: 'text', required: true, min: 10, max: 20, pattern: '^\\d+$' },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_whatsapp_contas_numero ON whatsapp_contas (numero)',
        'CREATE UNIQUE INDEX idx_whatsapp_contas_user ON whatsapp_contas (user_id)',
      ],
    })
    app.save(contas)

    const mensagens = new Collection({
      name: 'whatsapp_mensagens',
      type: 'base',
      listRule: "@request.auth.id != '' && user_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && user_id = @request.auth.id",
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'msg_id', type: 'text', required: true, max: 200 },
        { name: 'numero', type: 'text', max: 20 },
        {
          name: 'user_id',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'texto', type: 'text', max: 2000 },
        {
          name: 'transacao_id',
          type: 'relation',
          collectionId: transacoesId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'status',
          type: 'select',
          maxSelect: 1,
          values: ['processada', 'sem_vinculo', 'sem_valor', 'ignorada', 'erro'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_whatsapp_mensagens_msg_id ON whatsapp_mensagens (msg_id)',
        'CREATE INDEX idx_whatsapp_mensagens_user ON whatsapp_mensagens (user_id, created DESC)',
      ],
    })
    app.save(mensagens)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('whatsapp_mensagens'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('whatsapp_contas'))
    } catch (_) {}
  },
)
