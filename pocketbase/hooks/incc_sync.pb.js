// Endpoint no backend PocketBase para consulta e sincronização do INCC (SGS 192) direto do Banco Central do Brasil
routerAdd('GET', '/backend/v1/incc/sync', (c) => {
  try {
    // API pública do BCB SGS série 192: INCC variação percentual mensal
    const url = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.192/dados?formato=json'
    const res = $http.send({
      url: url,
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      timeout: 10,
    })

    if (res.statusCode !== 200) {
      return c.json(res.statusCode, { error: 'Erro ao consultar Banco Central', raw: res.raw })
    }

    const data = JSON.parse(res.raw)
    const indicesCol = $app.findCollectionByNameOrId('indices_incc')
    let inserted = 0
    let updated = 0

    // Itera pelos últimos 36 meses
    const recent = data.slice(-36)

    for (let i = 0; i < recent.length; i++) {
      const item = recent[i] // { data: "01/MM/YYYY", valor: "0.32" }
      const parts = item.data.split('/')
      if (parts.length !== 3) continue
      const mes = `${parts[2]}-${parts[1]}` // "YYYY-MM"
      const dateIso = `${parts[2]}-${parts[1]}-${parts[0]} 00:00:00.000Z`
      const variacao = parseFloat(item.valor.replace(',', '.'))

      try {
        const existing = $app.findFirstRecordByFilter('indices_incc', `mes = '${mes}'`)
        existing.set('variacao_mensal', variacao)
        existing.set('data_referencia', dateIso)
        existing.set('fonte', 'bcb_sgs_192')
        $app.save(existing)
        updated++
      } catch (_) {
        const rec = new Record(indicesCol)
        rec.set('mes', mes)
        rec.set('data_referencia', dateIso)
        rec.set('variacao_mensal', variacao)
        rec.set('fonte', 'bcb_sgs_192')
        $app.save(rec)
        inserted++
      }
    }

    return c.json(200, {
      success: true,
      message: 'Índice INCC sincronizado com o Banco Central com sucesso',
      inserted: inserted,
      updated: updated,
      totalProcessado: recent.length,
    })
  } catch (err) {
    return c.json(500, {
      success: false,
      error: err.message || String(err),
    })
  }
})

// Endpoint para calcular a correção de um imóvel com base no INCC
routerAdd('GET', '/backend/v1/incc/calcular', (c) => {
  try {
    const valorOriginal = parseFloat(c.request.url.query().get('valor') || '0')
    const mesBase = c.request.url.query().get('mesBase') || '' // ex: "2024-01"
    const defasagem = parseInt(c.request.url.query().get('defasagem') || '2', 10)

    if (!valorOriginal || !mesBase) {
      return c.json(400, { error: "Informe 'valor' e 'mesBase' (YYYY-MM)" })
    }

    // Busca todos os índices INCC ordenados por mês
    const indices = $app.findRecordsByFilter('indices_incc', "mes >= ''", 'mes', 200, 0)

    // Mês de referência atual com base na defasagem
    const hoje = new Date()
    const refDate = new Date(hoje.getFullYear(), hoje.getMonth() - defasagem, 1)
    const refAno = refDate.getFullYear()
    const refMesNum = String(refDate.getMonth() + 1).padStart(2, '0')
    const mesReferencia = `${refAno}-${refMesNum}`

    let fatorAcumulado = 1.0
    const mesesAplicados = []

    for (let i = 0; i < indices.length; i++) {
      const idxMes = indices[i].getString('mes')
      // Aplica do mês base até o mês de referência
      if (idxMes >= mesBase && idxMes <= mesReferencia) {
        const variacao = indices[i].getFloat('variacao_mensal')
        fatorAcumulado *= 1.0 + variacao / 100.0
        mesesAplicados.push({
          mes: idxMes,
          variacao: variacao,
        })
      }
    }

    const valorCorrigido = valorOriginal * fatorAcumulado
    const correcaoAcumulada = valorCorrigido - valorOriginal
    const percentualAcumulado = (fatorAcumulado - 1.0) * 100.0

    return c.json(200, {
      valorOriginal: valorOriginal,
      valorCorrigido: Math.round(valorCorrigido * 100) / 100,
      correcaoAcumulada: Math.round(correcaoAcumulada * 100) / 100,
      percentualAcumulado: Math.round(percentualAcumulado * 100) / 100,
      mesBase: mesBase,
      mesReferencia: mesReferencia,
      defasagemMeses: defasagem,
      mesesAplicadosCount: mesesAplicados.length,
      historico: mesesAplicados,
    })
  } catch (err) {
    return c.json(500, { error: err.message || String(err) })
  }
})
