/**
 * DIAGNÓSTICO TEMPORÁRIO — rota GET /diag/signup-check e cron de 1 em 1 minuto.
 * Reproduz o cadastro por loopback ($http.send contra a própria instância,
 * usando PB_INSTANCE_URL) e registra status + corpo nos logs ([diag-signup]).
 * REMOVER na próxima rodada (padrão das rotas diag anteriores).
 */

routerAdd('GET', '/diag/signup-check', (c) => {
  const instancia = $os.getenv('PB_INSTANCE_URL')
  if (!instancia) {
    return c.json(500, { error: 'PB_INSTANCE_URL não configurado' })
  }

  const email = 'diag+' + Date.now() + '@quitafy-teste.com'
  const telefone = '+55119' + String(Date.now()).slice(-8)

  const resp = $http.send({
    url: instancia.replace(/\/$/, '') + '/backend/v1/auth/registrar',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nome: 'Diagnóstico Cadastro',
      email: email,
      senha: 'senha-teste-123',
      telefone: telefone,
    }),
  })

  return c.json(200, { statusCode: resp.statusCode, body: resp.json })
})

cronAdd('diag_signup_check', '*/1 * * * *', () => {
  const instancia = $os.getenv('PB_INSTANCE_URL')
  if (!instancia) {
    console.error('[diag-signup] PB_INSTANCE_URL não configurado')
    return
  }
  const email = 'diag+' + Date.now() + '@quitafy-teste.com'
  const telefone = '+55119' + String(Date.now()).slice(-8)
  try {
    const resp = $http.send({
      url: instancia.replace(/\/$/, '') + '/backend/v1/auth/registrar',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Diagnóstico Cadastro',
        email: email,
        senha: 'senha-teste-123',
        telefone: telefone,
      }),
    })
    console.log('[diag-signup] status=' + resp.statusCode + ' body=' + JSON.stringify(resp.json))
  } catch (err) {
    console.error('[diag-signup] falhou: ' + ((err && err.message) || err))
  }
})
