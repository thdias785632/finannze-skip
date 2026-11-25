/**
 * Diagnóstico do cadastro (build v5): separa as hipóteses do bug do
 * e-mail de boas-vindas e permite PROVAR ao vivo o caminho cadastro→hook→e-mail.
 *
 * Rotas de diagnóstico (ambiente de desenvolvimento):
 *   GET /backend/v1/diag/hooks            → responde 200 se este arquivo carregou
 *   GET /backend/v1/diag/signup-teste?email=x@y.z
 *       → cria um usuário de teste via $app.save (mesmo caminho de persistência
 *         do cadastro real: dispara onRecordAfterCreateSuccess). Devolve o id
 *         para exclusão posterior.
 *   GET /backend/v1/diag/limpar?email=x@y.z
 *       → exclui o(s) usuário(s) de teste com esse e-mail.
 *
 * Cada disparo de afterCreateSuccess é gravado em diag_logs (coleção criada
 * na migração 0017) — prova legível sem depender do stream de logs.
 */
console.log('[diag_hooks] arquivo carregado — build v5')

routerAdd('GET', '/backend/v1/diag/hooks', (c) => {
  return c.json(200, {
    build: 'v5',
    ok: true,
    hora: new Date().toISOString(),
  })
})

routerAdd('GET', '/backend/v1/diag/signup-teste', (c) => {
  const email = String(c.request.url.query().get('email') || '').trim()
  if (!email || email.indexOf('@') < 0) {
    return c.json(400, { error: 'informe ?email=' })
  }
  try {
    const col = $app.findCollectionByNameOrId('users')
    const u = new Record(col)
    u.set('email', email)
    u.set('password', 'SenhaTeste!123')
    u.set('passwordConfirm', 'SenhaTeste!123')
    u.set('name', 'Teste Canario')
    u.set('plan', 'free')
    u.set('verified', true)
    $app.save(u)
    return c.json(200, { criado: true, id: u.id, email: email, build: 'v5' })
  } catch (err) {
    return c.json(500, {
      criado: false,
      erro: (err && err.message) || String(err),
      build: 'v5',
    })
  }
})

routerAdd('GET', '/backend/v1/diag/limpar', (c) => {
  const email = String(c.request.url.query().get('email') || '').trim()
  if (!email) return c.json(400, { error: 'informe ?email=' })
  let excluidos = []
  try {
    const lista = $app.findRecordsByFilter('users', "email = '" + email + "'", '', 10, 0)
    for (const u of lista) {
      $app.delete(u)
      excluidos.push(u.id)
    }
    return c.json(200, { excluidos: excluidos, build: 'v5' })
  } catch (err) {
    return c.json(500, { erro: (err && err.message) || String(err), excluidos: excluidos })
  }
})

$app.onRecordAfterCreateSuccess().add((e) => {
  const nomeColecao = (() => {
    try {
      return e.record.collection().name
    } catch (err) {
      return 'erro: ' + ((err && err.message) || err)
    }
  })()
  console.log('[diag_hooks] afterCreateSuccess GLOBAL disparou para ' + nomeColecao)
  try {
    const reg = new Record($app.findCollectionByNameOrId('diag_logs'))
    reg.set('fonte', 'diag_hooks')
    reg.set(
      'detalhe',
      'afterCreateSuccess GLOBAL para ' + nomeColecao + ' em ' + new Date().toISOString(),
    )
    $app.save(reg)
  } catch (err) {
    console.error('[diag_hooks] falha ao gravar diag_logs: ' + ((err && err.message) || err))
  }
})

// PROVA ao vivo automatizada: a cada minuto, cria um usuário de teste via
// $app.save — mesmo caminho de persistência do cadastro real (hook de banco
// dispara igual). Todo o rastro (callback tagged, global, e-mail) fica em
// diag_logs para leitura por db_query. Idempotente: roda uma vez só.
cronAdd('diag_cadastro_teste', '*/1 * * * *', () => {
  try {
    const jaFeito = $app.findRecordsByFilter('diag_logs', "fonte = 'diag_cron'", '', 1, 0)
    if (jaFeito.length > 0) return
    const reg = new Record($app.findCollectionByNameOrId('diag_logs'))
    reg.set('fonte', 'diag_cron')
    reg.set('detalhe', 'cron de prova disparou em ' + new Date().toISOString())
    $app.save(reg)
    const col = $app.findCollectionByNameOrId('users')
    const u = new Record(col)
    u.set('email', 'teste.canario.prova@exemplo.com')
    u.set('password', 'SenhaTeste!123')
    u.set('passwordConfirm', 'SenhaTeste!123')
    u.set('name', 'Teste Canario Cron')
    u.set('plan', 'free')
    u.set('verified', true)
    $app.save(u)
    console.log('[diag_hooks] cron criou usuário de teste: ' + u.id)
  } catch (err) {
    console.error('[diag_hooks] cron de prova falhou: ' + ((err && err.message) || err))
  }
})
