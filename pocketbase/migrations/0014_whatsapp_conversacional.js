/**
 * 0014 — WhatsApp conversacional (partes 4 e 6 do fluxo aprimorado).
 *
 * 1) Nova coleção `whatsapp_pendencias`: guarda a intenção em aberto de um
 *    número enquanto o bot espera um complemento (nome do cartão, ou se é
 *    entrada/saída). Uma pendência aberta por número:
 *      - expira sozinha em 1h (comparação `created < agora - 1h` no hook);
 *      - é apagada quando a resposta conclui o cadastro (aceita) ou quando a
 *        próxima mensagem não responde à pergunta (descartada).
 *    Como o campo `created` é autodate, o índice de busca usa ele.
 *
 * 2) Novos valores em whatsapp_mensagens.status: 'pendente' (bot perguntou e
 *    ficou esperando) e 'cancelada' (pendente descartado por resposta
 *    inválida). Os anteriores ficam como estão.
 */
migrate(
  (app) => {
    const usersId = '_pb_users_auth_'

    const pendencias = new Collection({
      name: 'whatsapp_pendencias',
      type: 'base',
      listRule: '@request.auth.id != "" && user_id = @request.auth.id',
      viewRule: '@request.auth.id != "" && user_id = @request.auth.id',
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        {
          name: 'numero',
          type: 'text',
          required: true,
        },
        {
          name: 'user_id',
          type: 'relation',
          required: true,
          collectionId: usersId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        // O que o bot está esperando: 'cartao' (nome do cartão) ou 'tipo'
        // (entrada ou saída).
        {
          name: 'aguardando',
          type: 'select',
          required: true,
          values: ['cartao', 'tipo'],
          maxSelect: 1,
        },
        // Intenção interpretada da mensagem original, em JSON:
        // { valor, tipo?, descricao, categoria_id?, parcelas?, recorrente?,
        //   recorrencia_periodo?, cartao_trecho? }
        {
          name: 'dados',
          type: 'json',
          maxSize: 4000,
        },
        {
          name: 'created',
          type: 'autodate',
          onCreate: true,
          onUpdate: false,
        },
        {
          name: 'updated',
          type: 'autodate',
          onCreate: true,
          onUpdate: true,
        },
      ],
      indexes: [
        // Um pendente aberto por número: a busca do hook sempre cai aqui.
        'CREATE UNIQUE INDEX idx_wp_numero ON whatsapp_pendencias (numero)',
        'CREATE INDEX idx_wp_created ON whatsapp_pendencias (created)',
      ],
    })
    app.save(pendencias)

    const mensagens = app.findCollectionByNameOrId('whatsapp_mensagens')
    mensagens.fields.getByName('status').values.push('pendente', 'cancelada')
    app.save(mensagens)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('whatsapp_pendencias')
      app.delete(col)
    } catch (_) {}
    try {
      const mensagens = app.findCollectionByNameOrId('whatsapp_mensagens')
      const st = mensagens.fields.getByName('status')
      st.values = st.values.filter((v) => v !== 'pendente' && v !== 'cancelada')
      app.save(mensagens)
    } catch (_) {}
  },
)
