/**
 * Interação pelo WhatsApp é exclusiva do plano Premium.
 * Adiciona o valor 'plano_insuficiente' ao select `status` de
 * whatsapp_mensagens — o webhook loga com esse status toda mensagem
 * recebida de um número cujo usuário é free ou VIP (nada é gravado em
 * transacoes e o bot responde explicando como ativar o Premium).
 */
migrate(
  (app) => {
    const mensagens = app.findCollectionByNameOrId('whatsapp_mensagens')
    const st = mensagens.fields.getByName('status')
    if (!st.values.includes('plano_insuficiente')) {
      st.values.push('plano_insuficiente')
      app.save(mensagens)
    }
  },
  (app) => {
    const mensagens = app.findCollectionByNameOrId('whatsapp_mensagens')
    const st = mensagens.fields.getByName('status')
    st.values = st.values.filter((v) => v !== 'plano_insuficiente')
    app.save(mensagens)
  },
)
