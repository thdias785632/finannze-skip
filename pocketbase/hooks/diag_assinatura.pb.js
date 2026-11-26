/**
 * DIAGNÓSTICO TEMPORÁRIO — rota GET /diag/assinatura-check + cron 1 min.
 * Sonda o binding $connectors no JSVM: lista TODAS as chaves, tenta chamar
 * executeAsOwner em diferentes formas (2 args, 3 args) contra uma ferramenta
 * de leitura inofensiva (STRIPE_LIST_PRODUCTS) e imprime o resultado.
 * REMOVER na próxima rodada.
 */

routerAdd('GET', '/diag/assinatura-check', (c) => {
  const resultado = {}

  // 1. todas as chaves do binding (string única, sem truncar)
  const chaves = []
  for (const k in $connectors) chaves.push(k + ':' + typeof $connectors[k])
  resultado.chaves = chaves.join(' | ')

  // 2. forma A: executeAsOwner(tool, args) — a que o hook usa hoje
  try {
    const resA = $connectors.executeAsOwner('STRIPE_LIST_PRODUCTS', { limit: 5 })
    let vistoA = ''
    try {
      vistoA = JSON.stringify(resA)
    } catch (_) {
      vistoA = '(não serializável)'
    }
    resultado.formaA_2args = vistoA
  } catch (e) {
    resultado.formaA_2args = 'ERRO: ' + ((e && e.message) || e)
  }

  // 3. forma B: executeAsOwner(toolkit, tool, args)
  try {
    const resB = $connectors.executeAsOwner('stripe', 'STRIPE_LIST_PRODUCTS', { limit: 5 })
    let vistoB = ''
    try {
      vistoB = JSON.stringify(resB)
    } catch (_) {
      vistoB = '(não serializável)'
    }
    resultado.formaB_3args = vistoB
  } catch (e) {
    resultado.formaB_3args = 'ERRO: ' + ((e && e.message) || e)
  }

  // 4. forma C: execute(tool, args) — modo usuário, só para comparar o erro
  try {
    const resC = $connectors.execute('STRIPE_LIST_PRODUCTS', { limit: 5 })
    let vistoC = ''
    try {
      vistoC = JSON.stringify(resC)
    } catch (_) {
      vistoC = '(não serializável)'
    }
    resultado.formaC_execute = vistoC
  } catch (e) {
    resultado.formaC_execute = 'ERRO: ' + ((e && e.message) || e)
  }

  // 5. status do toolkit stripe (diz se o dono tem a conta conectada)
  try {
    resultado.status = JSON.stringify($connectors.status())
  } catch (e) {
    resultado.status = 'ERRO: ' + ((e && e.message) || e)
  }

  return c.json(200, resultado)
})

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
