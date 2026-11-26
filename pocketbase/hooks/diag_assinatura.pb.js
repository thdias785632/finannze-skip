/**
 * DIAGNÓSTICO TEMPORÁRIO — rota GET /diag/assinatura-check.
 * Faz loopback autenticado do POST /backend/v1/assinatura/checkout (cria um
 * usuário de teste temporário, loga e chama o checkout como ele) e registra
 * status + corpo da resposta. REMOVER na próxima rodada.
 */

routerAdd('GET', '/diag/assinatura-check', (c) => {
  const instancia = $os.getenv('PB_INSTANCE_URL')
  if (!instancia) {
    return c.json(500, { error: 'PB_INSTANCE_URL não configurado' })
  }
  const base = instancia.replace(/\/$/, '')

  // 1. cria (ou reusa) um usuário de teste só para este diagnóstico
  const email = 'diag-assinatura@quitafy-teste.com'
  let userId = ''
  try {
    const existente = $app.findAuthRecordByEmail('users', email)
    userId = existente.id
  } catch (_) {
    const users = $app.findCollectionByNameOrId('users')
    const rec = new Record(users)
    rec.setEmail(email)
    rec.setPassword('senha-teste-123')
    rec.setVerified(true)
    rec.set('name', 'Diagnóstico Assinatura')
    rec.set('telefone', '+55118' + String(Date.now()).slice(-8))
    rec.set('plan', 'basico')
    $app.save(rec)
    userId = rec.id
  }

  // 2. loga e chama o checkout como esse usuário (loopback HTTP)
  const login = $http.send({
    url: base + '/api/collections/users/auth-with-password',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: email, password: 'senha-teste-123' }),
  })
  if (login.statusCode !== 200) {
    return c.json(200, { etapa: 'login', statusCode: login.statusCode, body: login.json })
  }
  const token = login.json && login.json.token

  const checkout = $http.send({
    url: base + '/backend/v1/assinatura/checkout',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      Origin: 'https://quitafy-teste.local',
    },
    body: JSON.stringify({ plano: 'bronze' }),
  })

  // forma real do binding $connectors neste JSVM
  const forma = {
    tipo: typeof $connectors,
    chaves: (() => {
      const ch = []
      for (const k in $connectors) ch.push(k + ':' + typeof $connectors[k])
      return ch
    })(),
  }

  return c.json(200, {
    etapa: 'checkout',
    statusCode: checkout.statusCode,
    body: checkout.json,
    connectors: forma,
  })
})

// loga o resultado a cada minuto: valido por list_logs (o budget de fetch_url acabou)
cronAdd('diag_assinatura_cron', '*/1 * * * *', () => {
  const instancia = $os.getenv('PB_INSTANCE_URL')
  if (!instancia) return
  try {
    const resp = $http.send({
      url: instancia.replace(/\/$/, '') + '/diag/assinatura-check',
      method: 'GET',
    })
    console.log('[diag-assinatura] ' + resp.statusCode + ' ' + JSON.stringify(resp.json))
  } catch (err) {
    console.error('[diag-assinatura] falhou: ' + ((err && err.message) || err))
  }
})
