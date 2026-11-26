/**
 * Direito de arrependimento (CDC art. 49): cancelamento com reembolso
 * integral em até 7 dias da contratação.
 *
 *   stripe_inicio — data de INÍCIO da assinatura atual do usuário (ISO, UTC).
 *     Gravada na ativação (retorno do checkout / cron). É a base do prazo de
 *     7 dias do arrependimento; se vazia, o hook usa created como fallback.
 *
 * Nenhum dado sensível é gravado: toda chamada ao Stripe passa pelo conector
 * owner no hook pocketbase/hooks/assinaturas.pb.js.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('stripe_inicio')) {
      users.fields.add(new DateField({ name: 'stripe_inicio' }))
    }
    app.save(users)

    // Backfill: assinatura ativa/canceling sem data de início herda o fim do
    // período atual menos 1 mês (a renovação mais recente). Idempotente — só
    // toca em quem tem período e não tem início.
    const faltando = app.findRecordsByFilter(
      'users',
      "stripe_subscription_id != '' && stripe_periodo_fim != '' && stripe_inicio = ''",
      '',
      500,
      0,
    )
    faltando.forEach(function (rec) {
      try {
        const fim = rec.getDateTime('stripe_periodo_fim')
        if (!fim || !fim.string) return
        const dataFim = new Date(fim.string())
        if (Number.isNaN(dataFim.getTime())) return
        const inicio = new Date(dataFim.getTime() - 30 * 24 * 60 * 60 * 1000)
        rec.set('stripe_inicio', inicio.toISOString())
        app.save(rec)
      } catch (e) {
        console.error(
          '[0023] backfill stripe_inicio falhou p/ ' + rec.id + ':',
          (e && e.message) || e,
        )
      }
    })
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (users.fields.getByName('stripe_inicio')) users.fields.removeByName('stripe_inicio')
    app.save(users)
  },
)
