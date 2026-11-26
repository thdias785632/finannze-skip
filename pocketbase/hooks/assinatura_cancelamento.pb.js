/**
 * Cancelamento de assinatura Quitafy — direito de arrependimento (CDC art. 49).
 *
 *   DENTRO de 7 dias da contratação: cancela a assinatura na Stripe
 *   IMEDIATAMENTE (STRIPE_CANCEL_SUBSCRIPTION) + reembolso INTEGRAL do
 *   pagamento inicial (STRIPE_CREATE_REFUND) + plano volta a "basico" na hora.
 *   APÓS 7 dias: só não renova (STRIPE_UPDATE_SUBSCRIPTION cancel_at_period_end)
 *   — benefícios mantidos até o fim do período pago, sem reembolso.
 *
 *   POST /backend/v1/assinatura/cancelar
 *
 * O prazo começa na data de início da assinatura (stripe_inicio; fallback
 * created do cadastro), gravada na ativação em assinaturas.pb.js.
 *
 * Notas JSVM PocketBase (obrigatórias):
 *   - callbacks routerAdd NÃO enxergam declarações de topo: todo helper e toda
 *     constante vivem INLINE dentro do próprio callback;
 *   - `auth` é propriedade (ou método) do evento — forma defensiva nos dois
 *     bindings;
 *   - $http/$app e demais globais são os do JSVM; conector owner via
 *     $connectors.executeAsOwner(tool, args) com 2 argumentos.
 */

routerAdd('POST', '/backend/v1/assinatura/cancelar', (c) => {
  try {
    const auth = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!auth || !auth.id) return c.json(401, { error: 'Não autenticado' })
    const rec = $app.findRecordById('users', auth.id)
    const status = rec.getString('stripe_status') || ''
    const sub = rec.getString('stripe_subscription_id') || ''
    if (!((status === 'active' || status === 'canceling') && sub)) {
      return c.json(400, { error: 'Sem assinatura ativa' })
    }

    function conector(tool, args) {
      const res = $connectors.executeAsOwner(tool, args || {})
      if (res && res.successful && res.data) return res.data
      const detalhe = res && res.error ? res.error : JSON.stringify(res)
      throw new Error('Stripe (' + tool + '): ' + detalhe)
    }

    // Data de início da assinatura → prazo de 7 dias do arrependimento.
    function dataIso(dt) {
      if (!dt || typeof dt.string !== 'function') return ''
      if (typeof dt.isZero === 'function' && dt.isZero()) return ''
      return dt.string()
    }
    const inicioIso =
      dataIso(rec.getDateTime('stripe_inicio')) || dataIso(rec.getDateTime('created'))
    const tInicio = inicioIso ? new Date(inicioIso).getTime() : NaN
    const dentroPrazo = Number.isNaN(tInicio)
      ? false // sem data confiável: comportamento conservador (sem reembolso)
      : Date.now() < tInicio + 7 * 24 * 60 * 60 * 1000

    const resposta = function (corpo) {
      return c.json(200, corpo)
    }

    if (dentroPrazo) {
      // ---- DIREITO DE ARREPENDIMENTO (até 7 dias) ----
      // 1) cancela a assinatura na Stripe IMEDIATAMENTE (não só a renovação)
      let cancelada = true
      let erroCancel = ''
      try {
        conector('STRIPE_CANCEL_SUBSCRIPTION', { subscription_id: sub })
      } catch (eCancel) {
        // segue: o reembolso é o direito do usuário — o cancelamento falho
        // fica registrado para conciliação manual no painel
        cancelada = false
        erroCancel = (eCancel && eCancel.message) || String(eCancel)
        console.error(
          '[assinaturas] arrependimento: falha ao cancelar sub ' + sub + ':',
          erroCancel,
        )
      }

      // 2) reembolso integral do pagamento inicial: fatura da assinatura →
      //    payment_intent → STRIPE_CREATE_REFUND sem amount (estorna tudo)
      let reembolso = 'nao_solicitado'
      let detalheReembolso = ''
      let paymentIntent = ''
      try {
        // catálogo do conector não tem "get subscription" por id solto: a
        // busca é customer + subscription_exposed_id
        const st = conector('STRIPE_GET_CUSTOMERS_CUSTOMER_SUBS_SUB_EXPOSED_ID', {
          customer: rec.getString('stripe_customer_id'),
          subscription_exposed_id: sub,
        })
        const latest = st && st.latest_invoice
        const invoiceId = latest ? (typeof latest === 'object' ? latest.id : latest) : ''
        let paymentIntent = ''
        if (invoiceId) {
          const fatura = conector('STRIPE_GET_INVOICES_INVOICE', {
            invoice: invoiceId,
            expand: ['payment_intent'],
          })
          paymentIntent =
            fatura && fatura.payment_intent
              ? typeof fatura.payment_intent === 'object'
                ? fatura.payment_intent.id
                : fatura.payment_intent
              : ''
        }
        if (paymentIntent) {
          const reemb = conector('STRIPE_CREATE_REFUND', {
            payment_intent: paymentIntent,
            reason: 'requested_by_customer',
            metadata: { app: 'quitafy', tipo: 'arrependimento_cdc', user_id: auth.id },
          })
          reembolso = reemb && reemb.status ? reemb.status : 'solicitado'
        } else {
          reembolso = 'pendente'
          detalheReembolso =
            'Pagamento inicial não localizado (fatura/PI) — estornar manualmente no painel do Stripe (Pagamentos → pagamento → Estornar).'
          console.error(
            '[assinaturas] ARREPENDIMENTO CDC: ' + detalheReembolso + ' usuário ' + auth.id,
          )
        }
      } catch (eReemb) {
        reembolso = 'pendente'
        detalheReembolso = (eReemb && eReemb.message) || String(eReemb)
        console.error(
          '[assinaturas] ARREPENDIMENTO CDC: reembolso NÃO concluído p/ usuário ' +
            auth.id +
            ' — estornar manualmente no painel do Stripe (Pagamentos → pagamento → Estornar). Erro: ' +
            detalheReembolso,
        )
      }

      // 3) plano volta a basico NA HORA (registro local), com o rastro
      const fim = rec.getDateTime('stripe_periodo_fim')
      rec.set('plan', 'basico')
      rec.set('stripe_status', cancelada ? 'canceled' : 'canceling')
      rec.set('stripe_cancelar', false)
      $app.save(rec)
      console.log(
        '[assinaturas] arrependimento CDC: usuário ' +
          auth.id +
          ' cancelado=' +
          cancelada +
          ' reembolso=' +
          reembolso +
          (detalheReembolso ? ' (' + detalheReembolso + ')' : ''),
      )

      return resposta({
        ativa: false,
        cancelando: !cancelada,
        cancelada: cancelada,
        reembolso: reembolso,
        reembolsoPendente: reembolso === 'pendente',
        arrependimento: true,
        plano: 'basico',
        status: cancelada ? 'canceled' : 'canceling',
        periodoFim:
          fim && typeof fim.string === 'function'
            ? fim.isZero && typeof fim.isZero === 'function' && fim.isZero()
              ? null
              : fim.string()
            : null,
        subscriptionId: sub,
        aviso:
          detalheReembolso || (erroCancel ? 'Cancelamento na Stripe falhou: ' + erroCancel : ''),
      })
    }

    // ---- APÓS 7 DIAS: cancelamento da renovação (comportamento atual) ----
    // cancel_at_period_end: vale até o fim do período já pago e depois cai
    // para basico — tanto no Stripe quanto no registro local
    conector('STRIPE_UPDATE_SUBSCRIPTION', {
      subscription_id: sub,
      cancel_at_period_end: true,
    })
    rec.set('stripe_status', 'canceling')
    rec.set('stripe_cancelar', true)
    $app.save(rec)
    console.log('[assinaturas] cancelamento pedido: usuário ' + auth.id)

    const fim = rec.getDateTime('stripe_periodo_fim')
    return resposta({
      ativa: true,
      cancelando: true,
      arrependimento: false,
      plano: rec.getString('stripe_plano') || '',
      status: 'canceling',
      periodoFim:
        fim && typeof fim.string === 'function'
          ? fim.isZero && typeof fim.isZero === 'function' && fim.isZero()
            ? null
            : fim.string()
          : null,
      subscriptionId: sub,
    })
  } catch (err) {
    console.error(
      '[assinaturas] erro ao cancelar:',
      (err && err.message) || err,
      (err && err.stack) || '',
    )
    return c.json(502, { error: (err && err.message) || 'Falha ao cancelar assinatura' })
  }
})

console.log('[assinaturas] cancelamento CDC carregado — arrependimento 7 dias (art. 49)')
