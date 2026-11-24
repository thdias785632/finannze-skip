/**
 * Webhook do WhatsApp Business (Meta Cloud API).
 *
 * Rotas:
 *   GET /backend/v1/whatsapp/webhook
 *     Handshake de verificação da Meta: valida hub.verify_token contra o
 *     secret WHATSAPP_VERIFY_TOKEN e devolve hub.challenge em texto puro.
 *   POST /backend/v1/whatsapp/webhook
 *     Recebe notificações de mensagens da Meta. Extrai o texto, resolve o
 *     usuário pelo número (coleção whatsapp_contas) e grava a despesa/entrada
 *     em transacoes. Resposta de confirmação via Graph API é best-effort:
 *     sem WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID a mensagem é só registrada.
 *
 * A Meta exige resposta em menos de 20s: nada aqui bloqueia além do necessário
 * e qualquer falha é capturada para não derrubar a rota em 500.
 * Formato do retorno de $http.send (JSVM): { statusCode, headers, body (array
 * de bytes), json, raw } — o log de falha imprime statusCode + corpo completo.
 * Nota da JSVM do PocketBase: callbacks rodam em pool separado — toda a lógica
 * fica inline dentro de cada callback, sem depender de declarações de topo.
 * Nota Skip Cloud: secrets ficam no store do PocketBase — leia com $secrets.get;
 * $os.getenv serve para envs de instância (PB_INSTANCE_URL etc.). O leitor de
 * secrets aparece duplicado (IIFE) dentro de cada callback pelo mesmo motivo.
 */

routerAdd('GET', '/backend/v1/whatsapp/webhook', (c) => {
  try {
    const info = c.requestInfo()
    const mode = (info.query && info.query['hub.mode']) || ''
    const token = (info.query && info.query['hub.verify_token']) || ''
    const challenge = (info.query && info.query['hub.challenge']) || ''

    console.log('[whatsapp_webhook] GET verificação da Meta:', {
      mode: mode,
      token: token ? '***' : '(vazio)',
    })

    const esperado = (function lerSecret(nome) {
      try {
        if ($secrets.has(nome)) return $secrets.get(nome)
      } catch (_) {}
      try {
        return $os.getenv(nome) || ''
      } catch (_) {
        return ''
      }
    })('WHATSAPP_VERIFY_TOKEN')
    if (!esperado) {
      console.error(
        '[whatsapp_webhook] WHATSAPP_VERIFY_TOKEN não configurado — verificação vai falhar',
      )
      return c.json(403, { error: 'Webhook não configurado' })
    }
    if (mode === 'subscribe' && token === esperado && challenge) {
      // A Meta exige o challenge cru, em texto puro.
      return c.string(200, challenge)
    }
    console.error('[whatsapp_webhook] verificação recusada (mode/token/challenge inválidos)')
    return c.json(403, { error: 'Verificação falhou' })
  } catch (err) {
    console.error('[whatsapp_webhook] erro no GET do webhook:', (err && err.message) || err)
    return c.json(403, { error: 'Verificação falhou' })
  }
})

routerAdd('POST', '/backend/v1/whatsapp/webhook', (c) => {
  // ---- helpers (inline: a JSVM não compartilha topo com callbacks) ----

  /** Registra a mensagem recebida (log + deduplicação pelo msg_id). */
  function registrarMensagem(msg, userId, status, transacaoId) {
    try {
      const rec = new Record($app.findCollectionByNameOrId('whatsapp_mensagens'))
      rec.set('msg_id', msg.id || 'sem_id_' + $security.randomString(12))
      rec.set('numero', msg.from)
      rec.set('user_id', userId)
      rec.set('texto', msg.texto)
      rec.set('status', status)
      if (transacaoId) rec.set('transacao_id', transacaoId)
      $app.save(rec)
    } catch (err) {
      console.error('[whatsapp_webhook] falha ao registrar mensagem:', (err && err.message) || err)
    }
  }

  /** Categoria "Outros" (ou a primeira do tipo) do usuário — fallback sem match. */
  function categoriaFallback(userId, tipo) {
    try {
      const lista = $app.findRecordsByFilter(
        'categorias',
        `user_id = '${userId}' && (tipo = '${tipo}' || tipo = 'ambos')`,
        'created',
        1,
        0,
      )
      if (lista.length > 0) return lista[0]
    } catch (_) {}
    try {
      return $app.findFirstRecordByFilter('categorias', `user_id = '${userId}' && tipo = '${tipo}'`)
    } catch (_) {}
    try {
      return $app.findFirstRecordByFilter('categorias', `user_id = '${userId}' && tipo = 'ambos'`)
    } catch (_) {}
    return null
  }

  /** Procura categoria do usuário cujo nome apareça no texto (match simples). */
  function categoriaPorTexto(userId, tipo, texto) {
    const termo = String(texto || '').toLowerCase()
    if (!termo) return null
    let candidatas = []
    try {
      candidatas = $app.findRecordsByFilter(
        'categorias',
        `user_id = '${userId}' && (tipo = '${tipo}' || tipo = 'ambos')`,
        'created',
        100,
        0,
      )
    } catch (_) {
      return null
    }
    // Nome mais longo primeiro: "Supermercado" vence "Mercado" quando ambos batem.
    candidatas.sort(function (a, b) {
      return b.getString('nome').length - a.getString('nome').length
    })
    for (const cat of candidatas) {
      const nome = String(cat.getString('nome') || '')
        .toLowerCase()
        .trim()
      if (nome.length >= 3 && termo.indexOf(nome) !== -1) return cat
    }
    return null
  }

  /** Interpreta o texto da mensagem: valor, tipo (despesa/receita). */
  function interpretarTexto(texto) {
    const t = String(texto || '')
      .toLowerCase()
      .replace(/r\$/g, ' ')

    const temGasto = /gast|paguei|pagamento|comprei|despesa/.test(t)
    const temReceita = /receb|entrada|sal[áa]rio|deposit|vendi|ganhei/.test(t)

    // Números: aceita "1.234,56", "1234.56" e "50"
    const m = t.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?/)
    if (!m) return null

    const inteiro = m[1].replace(/\./g, '')
    const centavos = m[2] || '0'
    const valor = parseFloat(inteiro + '.' + centavos)
    if (!isFinite(valor) || valor <= 0) return null

    const tipo = temReceita && !temGasto ? 'receita' : 'despesa'
    return { valor: valor, tipo: tipo }
  }

  /** Descrição = texto sem o valor e sem "R$", enxugado. */
  function descrever(texto) {
    let d = String(texto || '').trim()
    d = d.replace(/r\$\s*/gi, '')
    d = d.replace(/\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{1,2})?/g, '')
    d = d.replace(/\s{2,}/g, ' ').trim()
    if (!d) d = 'Movimento via WhatsApp'
    return d.substring(0, 120)
  }

  /** Extrai a primeira mensagem de texto do payload da Meta. */
  function extrairMensagem(payload) {
    try {
      const entries = payload && payload.entry
      if (!Array.isArray(entries)) return null
      for (const entry of entries) {
        const changes = entry && entry.changes
        if (!Array.isArray(changes)) continue
        for (const change of changes) {
          const value = change && change.value
          if (!value || !Array.isArray(value.messages)) continue
          for (const msg of value.messages) {
            if (!msg) continue
            const texto =
              (msg.text && msg.text.body) ||
              (msg.button && msg.button.text) ||
              (msg.interactive &&
                msg.interactive.button_reply &&
                msg.interactive.button_reply.title) ||
              ''
            const from = String(
              msg.from || (value.contacts && value.contacts[0] && value.contacts[0].wa_id) || '',
            )
            if (!from) continue
            return {
              id: String(msg.id || ''),
              from: from.replace(/\D/g, ''),
              texto: String(texto || '').trim(),
            }
          }
        }
      }
    } catch (err) {
      console.error(
        '[whatsapp_webhook] falha ao extrair mensagem do payload:',
        (err && err.message) || err,
      )
    }
    return null
  }

  /** Grava a transação a partir da mensagem interpretada. */
  function gravarTransacao(usuario, msg, interpretado) {
    const hoje = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z'
    const transacao = new Record($app.findCollectionByNameOrId('transacoes'))
    transacao.set('user_id', usuario.id)
    transacao.set('descricao', descrever(msg.texto))
    transacao.set('valor', interpretado.valor)
    transacao.set('tipo', interpretado.tipo)
    transacao.set('data', hoje)
    transacao.set('pago', true)

    const cat =
      categoriaPorTexto(usuario.id, interpretado.tipo, msg.texto) ||
      categoriaFallback(usuario.id, interpretado.tipo)
    if (cat) transacao.set('categoria_id', cat.id)

    $app.save(transacao)
    return transacao
  }

  /** Resposta de confirmação ao usuário no WhatsApp — best-effort. */
  function responderWhatsApp(numero, texto) {
    const token = (function lerSecret(nome) {
      try {
        if ($secrets.has(nome)) return $secrets.get(nome)
      } catch (_) {}
      try {
        return $os.getenv(nome) || ''
      } catch (_) {
        return ''
      }
    })('WHATSAPP_TOKEN')
    const phoneId = (function lerSecret(nome) {
      try {
        if ($secrets.has(nome)) return $secrets.get(nome)
      } catch (_) {}
      try {
        return $os.getenv(nome) || ''
      } catch (_) {
        return ''
      }
    })('WHATSAPP_PHONE_NUMBER_ID')
    if (!token || !phoneId) {
      console.log(
        '[whatsapp_webhook] WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausentes — pulo resposta',
      )
      return
    }
    try {
      const resp = $http.send({
        url: 'https://graph.facebook.com/v21.0/' + phoneId + '/messages',
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: numero,
          type: 'text',
          text: { body: texto },
        }),
        timeout: 10,
      })
      // $http.send devolve { statusCode, headers, body (bytes), json, raw } —
      // não existe campo "status" genérico na JSVM do PocketBase.
      const statusCode = typeof resp.statusCode === 'number' ? resp.statusCode : 0
      if (statusCode >= 200 && statusCode < 300) {
        console.log('[whatsapp_webhook] resposta enviada para', numero)
      } else {
        // Corpo da Graph API contém o erro real da Meta: error.code, error.message,
        // error.error_data.details, error.subcode etc.
        let corpo = ''
        try {
          if (resp.json !== undefined && resp.json !== null) {
            corpo = JSON.stringify(resp.json)
          }
        } catch (_) {}
        if (!corpo && resp.raw) {
          try {
            corpo = String(resp.raw)
          } catch (_) {}
        }
        if (!corpo && resp.body && resp.body.length) {
          try {
            const pedacos = []
            for (let i = 0; i < resp.body.length; i += 4096) {
              pedacos.push(String.fromCharCode.apply(null, resp.body.slice(i, i + 4096)))
            }
            corpo = pedacos.join('')
          } catch (_) {}
        }
        if (!corpo) corpo = '(sem corpo na resposta)'
        console.error(
          '[whatsapp_webhook] resposta falhou, status_code',
          statusCode,
          '— corpo da Graph API:',
          corpo,
        )
      }
    } catch (err) {
      console.error(
        '[whatsapp_webhook] erro ao responder no WhatsApp:',
        (err && err.message) || err,
      )
    }
  }

  // ---- fluxo da rota ----

  try {
    const info = c.requestInfo()
    const payload = info.body || {}

    const msg = extrairMensagem(payload)
    if (!msg) {
      // Status/delivery updates e outros eventos vêm sem messages — ok, 200.
      console.log('[whatsapp_webhook] POST sem mensagem de texto (status/eco) — 200')
      return c.json(200, { received: true })
    }

    console.log('[whatsapp_webhook] mensagem recebida de', msg.from, ':', msg.texto)

    // Deduplicação: a Meta pode reenviar o mesmo wamid.
    if (msg.id) {
      try {
        $app.findFirstRecordByFilter('whatsapp_mensagens', `msg_id = '${msg.id}'`)
        console.log('[whatsapp_webhook] mensagem duplicada, ignoro:', msg.id)
        return c.json(200, { received: true, duplicada: true })
      } catch (_) {
        /* não existe ainda — sigo */
      }
    }

    // Número → usuário do app (coleção whatsapp_contas).
    let conta = null
    try {
      conta = $app.findFirstRecordByFilter('whatsapp_contas', `numero = '${msg.from}'`)
    } catch (_) {
      conta = null
    }
    if (!conta) {
      console.log('[whatsapp_webhook] número sem vínculo:', msg.from)
      registrarMensagem(msg, '', 'sem_vinculo', '')
      return c.json(200, { received: true, vinculado: false })
    }
    const usuario = $app.findRecordById('users', conta.getString('user_id'))

    const interpretado = interpretarTexto(msg.texto)
    if (!interpretado) {
      console.log('[whatsapp_webhook] sem valor no texto, registro como ignorada:', msg.texto)
      registrarMensagem(msg, usuario.id, 'ignorada', '')
      return c.json(200, { received: true, interpretada: false })
    }

    let transacao = null
    try {
      transacao = gravarTransacao(usuario, msg, interpretado)
      console.log(
        '[whatsapp_webhook] transação criada:',
        transacao.id,
        interpretado.tipo,
        interpretado.valor,
        'para',
        usuario.getString('email'),
      )
    } catch (err) {
      console.error('[whatsapp_webhook] falha ao gravar transação:', (err && err.message) || err)
      registrarMensagem(msg, usuario.id, 'erro', '')
      return c.json(200, { received: true, gravada: false })
    }

    registrarMensagem(msg, usuario.id, 'processada', transacao.id)

    responderWhatsApp(
      msg.from,
      (interpretado.tipo === 'receita' ? '✅ Entrada registrada: ' : '✅ Despesa registrada: ') +
        'R$ ' +
        interpretado.valor.toFixed(2).replace('.', ',') +
        (transacao.getString('descricao') ? ' — ' + transacao.getString('descricao') : ''),
    )

    return c.json(200, { received: true, gravada: true, transacao_id: transacao.id })
  } catch (err) {
    // Nunca derrubar em 500: a Meta reenviaria e o fluxo travaria.
    console.error('[whatsapp_webhook] erro no POST do webhook:', (err && err.message) || err)
    return c.json(200, { received: true, erro: true })
  }
})
