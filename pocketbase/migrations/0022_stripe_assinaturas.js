/**
 * Campos de assinatura Stripe no usuário (checkout dentro do app).
 *
 *   stripe_customer_id     — cliente Stripe criado no momento do checkout
 *   stripe_subscription_id — assinatura ativa (bronze/prata/ouro)
 *   stripe_status          — active | canceling | canceled | ''
 *   stripe_plano           — plano contratado na assinatura (pode diferir do
 *                            plan quando o dono troca à mão)
 *   stripe_periodo_fim     — fim do período pago atual (ISO); após ele, cai
 *                            para basico se a assinatura não renovar
 *   stripe_cancelar        — cancelamento pedido pelo app (não renova)
 *
 * Nenhum dado sensível (chave, token) é gravado: toda chamada ao Stripe passa
 * pelo conector owner no hook pocketbase/hooks/assinaturas.pb.js.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('stripe_customer_id')) {
      users.fields.add(new TextField({ name: 'stripe_customer_id', max: 120 }))
    }
    if (!users.fields.getByName('stripe_subscription_id')) {
      users.fields.add(new TextField({ name: 'stripe_subscription_id', max: 120 }))
    }
    if (!users.fields.getByName('stripe_status')) {
      users.fields.add(new TextField({ name: 'stripe_status', max: 30 }))
    }
    if (!users.fields.getByName('stripe_plano')) {
      users.fields.add(new TextField({ name: 'stripe_plano', max: 30 }))
    }
    if (!users.fields.getByName('stripe_periodo_fim')) {
      users.fields.add(new DateField({ name: 'stripe_periodo_fim' }))
    }
    if (!users.fields.getByName('stripe_cancelar')) {
      users.fields.add(new BoolField({ name: 'stripe_cancelar' }))
    }
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    ;[
      'stripe_customer_id',
      'stripe_subscription_id',
      'stripe_status',
      'stripe_plano',
      'stripe_periodo_fim',
      'stripe_cancelar',
    ].forEach((nome) => {
      if (users.fields.getByName(nome)) users.fields.removeByName(nome)
    })
    app.save(users)
  },
)
