/**
 * Assinaturas Quitafy via Stripe — TODA chamada ao Stripe passa pelo conector
 * owner ($connectors.executeAsOwner com a conta Stripe conectada pelo dono no
 * painel Conectores). Nenhuma chave de API vive neste código.
 *
 * Rotas (todas autenticadas por token de usuário):
 *   GET  /backend/v1/assinatura           — estado da assinatura do usuário
 *   POST /backend/v1/assinatura/checkout  — cria a Checkout Session e devolve url
 *   GET  /backend/v1/assinatura/retorno   — volta do Stripe; ativa o plano
 *   POST /backend/v1/assinatura/cancelar  — não renova (cai p/ básico no fim)
 * Cron a cada 6h: garante ativação de sessão paga sem retorno e queda p/ básico.
 *
 * Ativação é idempotente: roda no retorno do checkout (navegação de success_url)
 * e no cron (checkout.session.completed não chega por webhook aqui — o app
 * consulta a sessão direto na Stripe).
 *
 * Notas JSVM PocketBase (obrigatórias):
 *   - callbacks routerAdd NÃO enxergam declarações de topo: todo helper e toda
 *     constante vivem INLINE dentro de cada callback;
 *   - $http.send devolve { statusCode, json, raw, body } — nunca "status";
 *   - secrets via $secrets.get/$os.getenv (não usados aqui: conector owner).
 */

routerAdd('GET', '/backend/v1/assinatura', (c) => {
  try {
    // JSVM: `auth` pode vir como MÉTODO ou como PROPRIEDADE do evento — chamar
    // como função quando é propriedade lança "Not a function: [object Object]"
    // e derruba a rota inteira. Forma defensiva que funciona nos dois bindings.
    const auth = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!auth || !auth.id) return c.json(401, { error: 'Não autenticado' })
    const rec = $app.findRecordById('users', auth.id)
    const status = rec.getString('stripe_status') || ''
    const plano = rec.getString('stripe_plano') || ''
    const sub = rec.getString('stripe_subscription_id') || ''
    const fim = rec.getDateTime('stripe_periodo_fim')
    return c.json(200, {
      ativa: (status === 'active' || status === 'canceling') && !!sub,
      cancelando: status === 'canceling' || rec.getBool('stripe_cancelar'),
      plano: plano,
      status: status,
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
      '[assinaturas] erro no estado:',
      (err && err.message) || err,
      (err && err.stack) || '',
    )
    return c.json(500, { error: 'Falha ao consultar assinatura' })
  }
})

cronAdd('assinaturas_cron', '0 */6 * * *', () => {
  try {
    const ORDEM = ['basico', 'bronze', 'prata', 'ouro']

    function conector(tool, args) {
      const res = $connectors.executeAsOwner(tool, args || {})
      if (res && res.successful && res.data) return res.data
      const detalhe = res && res.error ? res.error : JSON.stringify(res)
      throw new Error('Stripe (' + tool + '): ' + detalhe)
    }

    function ativarAssinatura(userId, dados) {
      const rec = $app.findRecordById('users', userId)
      rec.set('stripe_customer_id', dados.customerId || rec.getString('stripe_customer_id') || '')
      rec.set('stripe_subscription_id', dados.subscriptionId || '')
      rec.set('stripe_status', dados.status || 'active')
      rec.set('stripe_plano', dados.plano)
      rec.set('stripe_periodo_fim', dados.periodoFim || null)
      rec.set('stripe_cancelar', false)
      rec.set('plan', dados.plano)
      $app.save(rec)
      console.log(
        '[assinaturas] plano ' +
          dados.plano +
          ' ativado para usuário ' +
          userId +
          ' (assinatura ' +
          (dados.subscriptionId || '?') +
          ')',
      )
    }

    // --- sessões completas de até 48h cuja ativação não aconteceu (aba fechada)
    const agora = new Date()
    const recentes = $app.findRecordsByFilter(
      'users',
      "plan = 'basico' && stripe_customer_id != '' && stripe_subscription_id = ''",
      '',
      50,
      0,
    )
    recentes.forEach(function (rec) {
      try {
        const sessoes = conector('STRIPE_LIST_CHECKOUT_SESSIONS', {
          customer: rec.getString('stripe_customer_id'),
          status: 'complete',
          limit: 20,
        })
        const pendente = (
          sessoes && Array.isArray(sessoes)
            ? sessoes
            : sessoes && sessoes.data
              ? Array.isArray(sessoes.data)
                ? sessoes.data
                : []
              : []
        ).find(function (s) {
          return (
            s.metadata &&
            s.metadata.user_id === rec.id &&
            s.metadata.plano &&
            ORDEM.indexOf(s.metadata.plano) > 0 &&
            (s.payment_status === 'paid' || s.status === 'complete')
          )
        })
        if (!pendente) return
        const subId =
          typeof pendente.subscription === 'object'
            ? pendente.subscription.id
            : pendente.subscription
        let fim = null
        if (subId) {
          // catálogo do conector não tem "get subscription" por id solto: a
          // busca é customer + subscription_exposed_id
          const st = conector('STRIPE_GET_CUSTOMERS_CUSTOMER_SUBS_SUB_EXPOSED_ID', {
            customer: rec.getString('stripe_customer_id'),
            subscription_exposed_id: subId,
          })
          fim =
            st && st.current_period_end
              ? new Date(st.current_period_end * 1000).toISOString()
              : null
        }
        ativarAssinatura(rec.id, {
          customerId: rec.getString('stripe_customer_id'),
          subscriptionId: subId,
          status: 'active',
          plano: pendente.metadata.plano,
          periodoFim: fim,
        })
      } catch (e) {
        console.error(
          '[assinaturas] erro na sessão pendente de ' + rec.id + ':',
          (e && e.message) || e,
        )
      }
    })

    // --- vencidos: canceling com período passado → cai para basico
    const vencidos = $app.findRecordsByFilter(
      'users',
      "plan != 'basico' && stripe_status = 'canceling' && stripe_periodo_fim != '' && stripe_periodo_fim < @agora",
      '',
      100,
      0,
    )
    vencidos.forEach(function (rec) {
      try {
        const sub = rec.getString('stripe_subscription_id') || ''
        if (sub) {
          // catálogo do conector não tem "get subscription" por id solto: a
          // busca é customer + subscription_exposed_id
          const st = conector('STRIPE_GET_CUSTOMERS_CUSTOMER_SUBS_SUB_EXPOSED_ID', {
            customer: rec.getString('stripe_customer_id'),
            subscription_exposed_id: sub,
          })
          const fim = st && st.current_period_end
          // ainda não venceu na Stripe (relógio local adiantado): não derruba
          if (fim && new Date(fim * 1000) > agora) {
            rec.set('stripe_periodo_fim', new Date(fim * 1000).toISOString())
            $app.save(rec)
            return
          }
        }
        rec.set('plan', 'basico')
        rec.set('stripe_status', 'canceled')
        rec.set('stripe_cancelar', false)
        $app.save(rec)
        console.log('[assinaturas] período vencido: usuário ' + rec.id + ' caiu para basico')
      } catch (e) {
        console.error('[assinaturas] erro no vencimento de ' + rec.id + ':', (e && e.message) || e)
      }
    })
  } catch (err) {
    console.error('[assinaturas] erro no cron:', (err && err.message) || err)
  }
})

routerAdd('POST', '/backend/v1/assinatura/checkout', (c) => {
  try {
    const PRECOS_CENTAVOS = { bronze: 1499, prata: 2499, ouro: 2999 }
    const NOMES = { bronze: 'Quitafy Bronze', prata: 'Quitafy Prata', ouro: 'Quitafy Ouro' }

    // O conector devolve { successful, data, error } e o data é o ENVELOPE do
    // Stripe ({ object: 'list', data: [...], ... } ou o próprio objeto Stripe).
    function conector(tool, args) {
      const res = $connectors.executeAsOwner(tool, args || {})
      if (res && res.successful && res.data) return res.data
      const detalhe = res && res.error ? res.error : JSON.stringify(res)
      throw new Error('Stripe (' + tool + '): ' + detalhe)
    }

    // Envelope de lista do Stripe: { object: 'list', data: [...] }
    function itens(res) {
      if (!res) return []
      if (Array.isArray(res)) return res
      if (res.data && Array.isArray(res.data)) return res.data
      return []
    }

    function precoDoPlano(plano) {
      const lista = conector('STRIPE_LIST_PRODUCTS', { limit: 100 })
      const produtos = itens(lista)
      const existente = produtos.find(function (p) {
        return p.metadata && p.metadata.plano === plano && p.metadata.app === 'quitafy'
      })
      const centavos = PRECOS_CENTAVOS[plano]
      if (existente) {
        const precos = itens(
          conector('STRIPE_LIST_PRICES', { product: existente.id, active: true, limit: 100 }),
        )
        const ativo = precos.find(function (pr) {
          return (
            pr.active &&
            pr.currency === 'brl' &&
            pr.unit_amount === centavos &&
            pr.recurring &&
            pr.recurring.interval === 'month'
          )
        })
        if (ativo) return ativo.id
      }
      const produto = existente
        ? { id: existente.id }
        : conector('STRIPE_CREATE_PRODUCT', {
            name: NOMES[plano],
            description:
              'Assinatura mensal do plano ' + NOMES[plano].replace('Quitafy ', '') + ' do Quitafy',
            statement_descriptor: 'QUITAFY',
            metadata: { app: 'quitafy', plano: plano },
          })
      const preco = conector('STRIPE_CREATE_PRICE', {
        product: produto.id,
        currency: 'brl',
        unit_amount: centavos,
        recurring: { interval: 'month' },
        nickname: NOMES[plano] + ' mensal',
        metadata: { app: 'quitafy', plano: plano },
      })
      return preco.id
    }

    function clienteStripe(email, nome) {
      const achado = itens(conector('STRIPE_LIST_CUSTOMERS', { email: email, limit: 10 }))[0]
      if (achado) return achado.id
      const novo = conector('STRIPE_CREATE_CUSTOMER', {
        email: email,
        name: nome || 'Usuário Quitafy',
        description: 'Usuário Quitafy',
      })
      return novo.id
    }

    const auth = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!auth || !auth.id) return c.json(401, { error: 'Não autenticado' })

    const info = c.requestInfo()
    const plano = info.body && info.body.plano
    if (!PRECOS_CENTAVOS[plano]) return c.json(400, { error: 'Plano inválido' })

    const origem = (info.headers && (info.headers.origin || info.headers.Origin)) || ''
    const base = String(origem || '').replace(/\/$/, '')
    if (!base) return c.json(400, { error: 'Origem não informada' })

    const email = typeof auth.email === 'function' ? auth.email() : auth.email
    if (!email) return c.json(400, { error: 'Usuário sem e-mail' })

    const priceId = precoDoPlano(plano)
    const customerId = clienteStripe(email, auth.getString('name'))

    // id do usuário vai no client_reference_id E no metadata: no cron a sessão
    // pendente é achada por metadata.user_id (não há webhook configurado aqui)
    const sessao = conector('STRIPE_CREATE_CHECKOUT_SESSION', {
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: auth.id,
      metadata: { user_id: auth.id, plano: plano, app: 'quitafy' },
      success_url: base + '/planos?checkout=ok&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: base + '/planos?checkout=cancelado',
    })
    if (!sessao || !sessao.url) throw new Error('Stripe não devolveu a URL de checkout')

    console.log('[assinaturas] checkout criado: usuário ' + auth.id + ' plano ' + plano)
    return c.json(200, { url: sessao.url, sessionId: sessao.id })
  } catch (err) {
    console.error(
      '[assinaturas] erro no checkout:',
      (err && err.message) || err,
      (err && err.stack) || '',
    )
    return c.json(502, { error: (err && err.message) || 'Falha ao iniciar checkout' })
  }
})

routerAdd('GET', '/backend/v1/assinatura/retorno', (c) => {
  try {
    const ORDEM = ['basico', 'bronze', 'prata', 'ouro']

    function conector(tool, args) {
      const res = $connectors.executeAsOwner(tool, args || {})
      if (res && res.successful && res.data) return res.data
      const detalhe = res && res.error ? res.error : JSON.stringify(res)
      throw new Error('Stripe (' + tool + '): ' + detalhe)
    }

    // Envelope de lista do Stripe: { object: 'list', data: [...] }
    function itens(res) {
      if (!res) return []
      if (Array.isArray(res)) return res
      if (res.data && Array.isArray(res.data)) return res.data
      return []
    }

    function ativarAssinatura(userId, dados) {
      const rec = $app.findRecordById('users', userId)
      rec.set('stripe_customer_id', dados.customerId || rec.getString('stripe_customer_id') || '')
      rec.set('stripe_subscription_id', dados.subscriptionId || '')
      rec.set('stripe_status', dados.status || 'active')
      rec.set('stripe_plano', dados.plano)
      rec.set('stripe_periodo_fim', dados.periodoFim || null)
      rec.set('stripe_cancelar', false)
      rec.set('plan', dados.plano)
      $app.save(rec)
      console.log(
        '[assinaturas] plano ' +
          dados.plano +
          ' ativado para usuário ' +
          userId +
          ' (assinatura ' +
          (dados.subscriptionId || '?') +
          ')',
      )
    }

    const auth = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!auth || !auth.id) return c.json(401, { error: 'Não autenticado' })
    const info = c.requestInfo()
    const sessionId = (info.query && info.query.session_id) || ''
    if (!sessionId) return c.json(400, { error: 'session_id ausente' })

    const sessao = conector('STRIPE_RETRIEVE_CHECKOUT_SESSION', {
      session: sessionId,
      expand: ['subscription'],
    })
    const pago = sessao && (sessao.payment_status === 'paid' || sessao.status === 'complete')
    if (!pago) {
      return c.json(402, {
        error: 'Pagamento não concluído',
        status: sessao && sessao.status,
      })
    }

    // plano contratado: line item → produto → metadata.plano
    const listaItens = itens(
      conector('STRIPE_GET_CHECKOUT_SESSIONS_SESSION_LINE_ITEMS', {
        session: sessao.id,
        limit: 10,
      }),
    )
    // plano contratado: 1) metadata da própria sessão (gravado no checkout —
    // caminho primário, sem chamadas extras); 2) fallback: line item → produto
    // → metadata.plano (STRIPE_GET_PRODUCTS_ID, slug real do catálogo)
    const primeiro = listaItens[0]
    let plano = null
    const metaSessao = sessao.metadata || {}
    if (metaSessao.user_id === auth.id && ORDEM.indexOf(metaSessao.plano) > 0) {
      plano = metaSessao.plano
    }
    if (!plano && primeiro && primeiro.price && primeiro.price.product) {
      const produtoId =
        typeof primeiro.price.product === 'object'
          ? primeiro.price.product.id
          : primeiro.price.product
      const produto = conector('STRIPE_GET_PRODUCTS_ID', { id: produtoId })
      const meta = produto && produto.metadata && produto.metadata.plano
      if (ORDEM.indexOf(meta) > 0) plano = meta
    }
    if (!plano) {
      return c.json(422, { error: 'Não foi possível identificar o plano da sessão' })
    }

    const sub = typeof sessao.subscription === 'object' ? sessao.subscription : null
    const periodoFim =
      sub && sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null

    ativarAssinatura(auth.id, {
      customerId: typeof sessao.customer === 'object' ? sessao.customer.id : sessao.customer,
      subscriptionId:
        typeof sessao.subscription === 'object' ? sessao.subscription.id : sessao.subscription,
      status: 'active',
      plano: plano,
      periodoFim: periodoFim,
    })
    return c.json(200, { ativado: true, plano: plano })
  } catch (err) {
    console.error(
      '[assinaturas] erro no retorno:',
      (err && err.message) || err,
      (err && err.stack) || '',
    )
    return c.json(502, { error: (err && err.message) || 'Falha ao ativar assinatura' })
  }
})

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
    return c.json(200, {
      ativa: true,
      cancelando: true,
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

console.log('[assinaturas] hook carregado — checkout/cancelamento via conector Stripe owner')
