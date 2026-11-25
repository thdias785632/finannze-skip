/**
 * Webhook do WhatsApp Business (Meta Cloud API) — fluxo conversacional.
 *
 * Rotas:
 *   GET /backend/v1/whatsapp/webhook
 *     Handshake de verificação da Meta: valida hub.verify_token contra o
 *     secret WHATSAPP_VERIFY_TOKEN e devolve hub.challenge em texto puro.
 *   POST /backend/v1/whatsapp/webhook
 *     Recebe notificações de mensagens da Meta, resolve o usuário pelo número
 *     (coleção whatsapp_contas) e grava o movimento em transacoes:
 *       - despesa comum ("gastei 50 no uber");
 *       - despesa em CARTÃO ("comprei 300 de mercado no cartão nubank") — o
 *         nome do cartão é casado, tolerante a acento/caixa, com as contas do
 *         usuário; se citou cartão sem nome identificável, PERGUNTA qual;
 *       - RECEITA ("recebi 1000 de salário", "entrei 200 pix");
 *       - PARCELADA ("em 10x", "10x de 50" — mesma lógica de série do app:
 *         serie_id/parcela_numero/parcela_total, valor/N por mês);
 *       - RECORRENTE ("assinatura netflix 55 todo mês", "recorrente");
 *       - entrada vs. saída ambígua → o bot PERGUNTA antes de gravar.
 *     Perguntas ficam em whatsapp_pendencias (uma por número, expira em 1h);
 *     a resposta seguinte do mesmo número é interpretada como complemento,
 *     a menos que pareça um comando novo (tem valor → mensagem nova).
 *     RESTRIÇÃO DE PLANO: a interação pelo WhatsApp é exclusiva do plano
 *     Premium — quem é free ou VIP tem a mensagem LOGADA (nada é gravado em
 *     transacoes) e recebe uma resposta explicando como ativar o Premium.
 *
 * A Meta exige resposta em menos de 20s: nada aqui bloqueia além do necessário
 * e qualquer falha é capturada para não derrubar a rota em 500. A transação é
 * gravada ANTES da tentativa de resposta; a resposta via Graph API é
 * best-effort (sem WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID apenas registra).
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

  const PENDENCIA_TTL_HORAS = 1
  const MAX_PARCELAS = 24

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

  /** Apaga a pendência aberta do número, se houver (idempotente). */
  function limparPendencia(numero) {
    try {
      const p = $app.findFirstRecordByFilter('whatsapp_pendencias', `numero = '${numero}'`)
      $app.delete(p)
    } catch (_) {
      /* não havia pendência */
    }
  }

  /**
   * Pendência ainda válida do número (expira em PENDENCIA_TTL_HORAS). Expirada
   * é apagada e tratada como inexistente.
   */
  function pendenciaAtiva(numero) {
    try {
      const p = $app.findFirstRecordByFilter('whatsapp_pendencias', `numero = '${numero}'`)
      const criada = String(p.getString('created') || '')
      const limite = new Date(Date.now() - PENDENCIA_TTL_HORAS * 3600 * 1000)
        .toISOString()
        .replace('T', ' ')
        .substring(0, 19)
      if (criada && criada < limite) {
        try {
          $app.delete(p)
        } catch (_) {}
        return null
      }
      return p
    } catch (_) {
      return null
    }
  }

  /** Grava (ou substitui) a pendência do número com a intenção em aberto. */
  function salvarPendencia(numero, userId, aguardando, dados) {
    limparPendencia(numero)
    try {
      const rec = new Record($app.findCollectionByNameOrId('whatsapp_pendencias'))
      rec.set('numero', numero)
      rec.set('user_id', userId)
      rec.set('aguardando', aguardando)
      rec.set('dados', JSON.stringify(dados || {}))
      $app.save(rec)
    } catch (err) {
      console.error('[whatsapp_webhook] falha ao salvar pendência:', (err && err.message) || err)
    }
  }

  /** Lê o JSON `dados` da pendência com fallback seguro. */
  function dadosDaPendencia(p) {
    let bruto = ''
    try {
      bruto = p.getString('dados') || ''
    } catch (_) {}
    try {
      const obj = JSON.parse(bruto)
      if (obj && typeof obj === 'object') return obj
    } catch (_) {}
    return {}
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
    const termo = semAcento(String(texto || '').toLowerCase())
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
      const nome = semAcento(
        String(cat.getString('nome') || '')
          .toLowerCase()
          .trim(),
      )
      if (nome.length >= 3 && termo.indexOf(nome) !== -1) return cat
    }
    return null
  }

  /** Remove acentos (para casar cartão/categoria tolerante a acento/caixa). */
  function semAcento(s) {
    return String(s || '')
      .replace(/[\u00c0-\u00c6\u00e0-\u00e6]/g, 'a')
      .replace(/[\u00c8-\u00cb\u00e8-\u00eb]/g, 'e')
      .replace(/[\u00cc-\u00cf\u00ec-\u00ef]/g, 'i')
      .replace(/[\u00d2-\u00d6\u00f2-\u00f6]/g, 'o')
      .replace(/[\u00d9-\u00dc\u00f9-\u00fc]/g, 'u')
      .replace(/[\u00d1\u00f1]/g, 'n')
      .replace(/[\u00c7\u00e7]/g, 'c')
  }

  /** Normaliza o nome informado no chat para casar com o cadastro do cartão. */
  function nomeCartaoNormalizado(nome) {
    const t = semAcento(String(nome || '').toLowerCase())
    return t
      .replace(/cart[ãa]o?|cartao|\bdo\b|\bda\b|\bde\b|\bd[oas]?\b/g, ' ')
      .replace(/\bcredit|\bdebit|\bcr[eé]dito|\bd[eé]bito/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  }

  /**
   * Cartão do usuário cujo nome casa com o texto (ou com o trecho citado).
   * Cada palavra do nome do cartão precisa aparecer no termo — "cartão nu"
   * acha "Nubank" sem dar falso positivo em "Inter".
   */
  function cartaoPorTexto(userId, termo) {
    const t = semAcento(String(termo || '').toLowerCase())
    if (!t) return null
    let cartoes = []
    try {
      cartoes = $app.findRecordsByFilter('cartoes', `user_id = '${userId}'`, 'created', 50, 0)
    } catch (_) {
      return null
    }
    for (const cartao of cartoes) {
      const chave = nomeCartaoNormalizado(cartao.getString('nome'))
      if (!chave) continue
      const palavras = chave.split(' ').filter(function (p) {
        return p.length >= 3
      })
      if (palavras.length === 0) {
        if (t.indexOf(chave) !== -1) return cartao
        continue
      }
      const todos = palavras.every(function (p) {
        return t.indexOf(p) !== -1
      })
      if (todos) return cartao
    }
    return null
  }

  /** true quando o texto menciona um cartão sem dizer qual ("no cartão..."). */
  function mencionaCartaoSemNome(texto) {
    const t = semAcento(String(texto || '').toLowerCase())
    return /(^|[^a-z])(no|na|pelo|pela|do|da|um|uma)\s+cartao(\s|$|,|\.|!|\?)/.test(t)
  }

  /** Interpreta o texto: valor, tipo (despesa/receita/duvida), parcelas, recorrente. */
  function interpretarTexto(texto) {
    const t = semAcento(
      String(texto || '')
        .toLowerCase()
        .replace(/r\$/g, ' '),
    )

    const temGasto = /gast|paguei|pagamento|comprei|despesa|compra|assinatura|assinei|gasto/.test(t)
    const temReceita =
      /receb|recebi|entrada|entrei|sal[áa]rio|deposit|vendi|venda|ganhei|ganho|rendiment|provent|reembols/.test(
        t,
      )

    // Recorrente: "todo mês", "mensal", "fixo", "assinatura", "recorrente".
    const recorrente =
      /todo mes|todos os meses|mensal|mensalmente|recorrente|recorrencia|fixo|fixa|assinatura|assinou|por mes/.test(
        t,
      ) || temAssinatura(t)

    // Parcelas: "em 10x", "10x de 50", "em 12 vezes".
    let parcelas = 0
    const mParc =
      t.match(/(?:em\s*)?(\d{1,2})\s*x\b/) ||
      t.match(/(\d{1,2})\s*vezes/) ||
      t.match(/parcelad[oa]?\s+em\s+(\d{1,2})/) ||
      t.match(/em\s+(\d{1,2})\s*parcelas?/)
    if (mParc) {
      const n = parseInt(mParc[1], 10)
      if (isFinite(n) && n >= 1 && n <= MAX_PARCELAS) parcelas = n
      // "1x" não é parcelado — é à vista.
      if (parcelas === 1) parcelas = 0
    }

    // Números: aceita "1.234,56", "1234.56", "50" e "10x de 50".
    let m = null
    if (mParc && /(?:em\s*)?\d{1,2}\s*x\b/.test(t)) {
      // Formato "10x de 50": o valor é o que vem DEPOIS do "x".
      const depois = t.slice(mParc.index + mParc[0].length)
      m = depois.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?/)
    }
    if (!m) {
      m = t.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?/)
    }
    if (!m) return null

    const inteiro = m[1].replace(/\./g, '')
    const centavos = m[2] || '0'
    const valor = parseFloat(inteiro + '.' + centavos)
    if (!isFinite(valor) || valor <= 0) return null

    let tipo = 'despesa'
    if (temReceita && !temGasto) tipo = 'receita'
    else if (temReceita && temGasto) tipo = 'duvida'

    return {
      valor: valor,
      tipo: tipo,
      parcelas: parcelas,
      recorrente: recorrente,
      textoNormalizado: t,
    }
  }

  /** "assinatura"/"assinou" implica recorrente (o valor pode não vir com "todo mês"). */
  function temAssinatura(t) {
    return /assinatura|assinou|plano/.test(t)
  }

  /** Descrição = texto sem o valor, sem "R$", sem "em Nx" etc., enxugado. */
  function descrever(texto) {
    let d = String(texto || '').trim()
    d = d.replace(/r\$\s*/gi, '')
    d = d.replace(/\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{1,2})?(?:\s*x)?/g, '')
    d = d.replace(/\b(em|de|no|na|pelo|pela|do|da|todo|toda|mes|m[eê]s|x|vezes|parcelas?)\b/gi, ' ')
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

  /**
   * Grava a transação a partir da intenção interpretada. Parcelado cria a
   * série com a MESMA lógica do app (uma transação por mês, valor/N,
   * serie_id/parcela_numero/parcela_total); recorrente grava com
   * recorrente=true e recorrencia_periodo='mensal' (a réplica virtual dos
   * meses seguintes é feita na leitura pelo extrato).
   */
  function gravarTransacao(usuario, texto, intento, cartao) {
    const hoje = new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z'
    const transacao = new Record($app.findCollectionByNameOrId('transacoes'))
    transacao.set('user_id', usuario.id)
    transacao.set('descricao', descrever(texto))
    transacao.set('valor', intento.parcelas > 1 ? intento.valor / intento.parcelas : intento.valor)
    transacao.set('tipo', intento.tipo)
    transacao.set('data', hoje)
    transacao.set('pago', true)

    if (cartao) transacao.set('cartao_id', cartao.id)

    if (intento.recorrente) {
      transacao.set('recorrente', true)
      transacao.set('recorrencia_periodo', 'mensal')
    }

    if (intento.parcelas > 1) {
      transacao.set('serie_id', 'serie:' + Date.now().toString(36) + $security.randomString(6))
      transacao.set('parcela_numero', 1)
      transacao.set('parcela_total', intento.parcelas)
    }

    const cat =
      categoriaPorTexto(usuario.id, intento.tipo, texto) ||
      categoriaFallback(usuario.id, intento.tipo)
    if (cat) transacao.set('categoria_id', cat.id)

    $app.save(transacao)
    return transacao
  }

  /** Cria as parcelas 2..N da série (mesmo dia, mês seguinte a cada uma). */
  function criarParcelasSeguintes(usuario, texto, intento, cartao, primeira) {
    const serieId = primeira.getString('serie_id')
    const descBase = primeira.getString('descricao')
    const n = intento.parcelas
    const valorParcela = intento.valor / n
    const hoje = new Date()
    const cat = primeira.getString('categoria_id')

    for (let k = 2; k <= n; k++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + (k - 1), hoje.getDate())
      const dataParcela =
        d.getFullYear() +
        '-' +
        String(d.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(d.getDate()).padStart(2, '0') +
        ' ' +
        String(hoje.getHours()).padStart(2, '0') +
        ':' +
        String(hoje.getMinutes()).padStart(2, '0') +
        ':' +
        String(hoje.getSeconds()).padStart(2, '0') +
        'Z'
      try {
        const rec = new Record($app.findCollectionByNameOrId('transacoes'))
        rec.set('user_id', usuario.id)
        rec.set('descricao', descBase + ' (' + k + '/' + n + ')')
        rec.set('valor', valorParcela)
        rec.set('tipo', intento.tipo)
        rec.set('data', dataParcela)
        rec.set('pago', true)
        if (cartao) rec.set('cartao_id', cartao.id)
        if (cat) rec.set('categoria_id', cat)
        if (serieId) rec.set('serie_id', serieId)
        rec.set('parcela_numero', k)
        rec.set('parcela_total', n)
        $app.save(rec)
      } catch (err) {
        console.error(
          '[whatsapp_webhook] falha ao criar parcela ' + k + '/' + n + ':',
          (err && err.message) || err,
        )
      }
    }
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

    // ---- trava de plano: interação pelo WhatsApp é exclusiva do Premium ----
    // Free e VIP têm a mensagem registrada (com um status próprio, para o
    // log do painel), NADA é gravado em transacoes e o bot explica o plano.
    const planoUsuario = String(usuario.getString('plan') || 'free').toLowerCase()
    if (planoUsuario !== 'premium') {
      console.log(
        '[whatsapp_webhook] interação bloqueada: usuário',
        usuario.getString('email'),
        'no plano',
        planoUsuario,
        '(WhatsApp é exclusivo do Premium)',
      )
      registrarMensagem(msg, usuario.id, 'plano_insuficiente', '')
      limparPendencia(msg.from)
      responderWhatsApp(
        msg.from,
        '🔒 Olha, o atendimento pelo WhatsApp faz parte do plano *Premium* do Quitafy (R$ 29,90/mês), ' +
          'que também inclui o módulo de Imóveis na planta com correção pelo INCC.\n\n' +
          'Pra liberar, basta falar com a gente pedindo a ativação do Premium — a ativação é manual ' +
          'e o time faz rapidinho. Depois disso, volta aqui e registra tudo por mensagem: ' +
          '"gastei 50 no uber", "recebi 1000 de salário", parcelas, recorrentes e mais.\n\n' +
          'Enquanto isso, você pode lançar suas despesas normalmente pelo app. 💜',
      )
      return c.json(200, { received: true, bloqueado_plano: planoUsuario })
    }

    // Texto vazio (só espaços/emoji colado errado) — não grava nada.
    if (!String(msg.texto || '').trim()) {
      console.log('[whatsapp_webhook] texto vazio, registro como ignorada')
      registrarMensagem(msg, usuario.id, 'ignorada', '')
      responderWhatsApp(
        msg.from,
        '🤔 Não entendi. Tente algo como: "gastei 50 no uber", "recebi 1000 de salário" ou "comprei 300 de mercado no cartão nubank em 2x".',
      )
      return c.json(200, { received: true, interpretada: false })
    }

    // ---- pendência aberta? Tento interpretar como resposta ----
    const pendente = pendenciaAtiva(msg.from)
    if (pendente) {
      const aguardando = pendente.getString('aguardando')
      const dados = dadosDaPendencia(pendente)
      console.log(
        '[whatsapp_webhook] pendência aberta, aguardando:',
        aguardando,
        '— resposta:',
        msg.texto,
      )

      if (aguardando === 'cartao') {
        const cartao = cartaoPorTexto(usuario.id, msg.texto)
        if (cartao) {
          limparPendencia(msg.from)
          registrarMensagem(msg, usuario.id, 'processada', '')
          return concluirCadastro(usuario, msg, dados, cartao)
        }
        // Não é um cartão válido: e parece mensagem nova (tem valor)?
        const novaTentativa = interpretarTexto(msg.texto)
        if (novaTentativa) {
          limparPendencia(msg.from)
          registrarMensagem(msg, usuario.id, 'cancelada', '')
          return processarNovaMensagem(usuario, msg, novaTentativa)
        }
        // Ainda não sei qual cartão: pergunto de novo.
        registrarMensagem(msg, usuario.id, 'pendente', '')
        responderWhatsApp(
          msg.from,
          '❓ Não achei esse cartão. Qual é o nome dele? (ex.: "nubank", "inter gold") — ou mande a despesa de novo sem cartão.',
        )
        return c.json(200, { received: true, pendente: true })
      }

      if (aguardando === 'tipo') {
        const resposta = semAcento(String(msg.texto || '').toLowerCase())
        let tipo = ''
        if (/receb|entrada|entrei|salario|deposit|ganhei|receita/.test(resposta)) tipo = 'receita'
        else if (/gast|sa[íi]da|paguei|comprei|despesa|compra/.test(resposta)) tipo = 'despesa'

        if (tipo) {
          limparPendencia(msg.from)
          dados.tipo = tipo
          registrarMensagem(msg, usuario.id, 'processada', '')
          return concluirCadastro(usuario, msg, dados, null)
        }
        const novaTentativa = interpretarTexto(msg.texto)
        if (novaTentativa) {
          limparPendencia(msg.from)
          registrarMensagem(msg, usuario.id, 'cancelada', '')
          return processarNovaMensagem(usuario, msg, novaTentativa)
        }
        registrarMensagem(msg, usuario.id, 'pendente', '')
        responderWhatsApp(
          msg.from,
          '❓ Me diz: foi ENTRADA (recebi, salário, reembolso) ou SAÍDA (gastei, paguei)?',
        )
        return c.json(200, { received: true, pendente: true })
      }

      // Pendência num estado desconhecido: descarto e trato como nova.
      limparPendencia(msg.from)
    }

    // ---- mensagem nova ----
    return processarNovaMensagem(usuario, msg, interpretarTexto(msg.texto))

    /**
     * Trata uma mensagem nova (não é resposta a pendência): interpreta,
     * valida e grava ou pergunta.
     */
    function processarNovaMensagem(usuario, msg, interpretado) {
      if (!interpretado) {
        console.log('[whatsapp_webhook] sem valor no texto, registro como ignorada:', msg.texto)
        registrarMensagem(msg, usuario.id, 'ignorada', '')
        responderWhatsApp(
          msg.from,
          '🤔 Não consegui identificar o valor. Tente algo como: "gastei 50 no uber" ou "recebi 1000 de salário".',
        )
        return c.json(200, { received: true, interpretada: false })
      }

      // Entrada vs. saída ambígua: PERGUNTO antes de gravar.
      if (interpretado.tipo === 'duvida') {
        console.log('[whatsapp_webhook] tipo ambíguo, pergunto:', msg.texto)
        salvarPendencia(msg.from, usuario.id, 'tipo', {
          valor: interpretado.valor,
          parcelas: interpretado.parcelas,
          recorrente: interpretado.recorrente,
          descricao: descrever(msg.texto),
        })
        registrarMensagem(msg, usuario.id, 'pendente', '')
        responderWhatsApp(
          msg.from,
          '❓ R$ ' +
            formatarValor(interpretado.valor) +
            ' — foi ENTRADA (recebi, salário) ou SAÍDA (gastei, paguei)?',
        )
        return c.json(200, { received: true, pendente: true })
      }

      // "no cartão" sem nome identificável: PERGUNTO qual.
      let cartao = null
      let citouCartao = false
      if (interpretado.tipo === 'despesa' && mencionaCartaoSemNome(msg.texto)) {
        citouCartao = true
        cartao = cartaoPorTexto(usuario.id, msg.texto)
        if (!cartao) {
          console.log('[whatsapp_webhook] cartão citado sem nome, pergunto:', msg.texto)
          salvarPendencia(msg.from, usuario.id, 'cartao', {
            valor: interpretado.valor,
            parcelas: interpretado.parcelas,
            recorrente: interpretado.recorrente,
            descricao: descrever(msg.texto),
          })
          registrarMensagem(msg, usuario.id, 'pendente', '')
          responderWhatsApp(
            msg.from,
            '❓ Em qual cartão? Responda com o nome dele (ex.: "nubank", "inter").',
          )
          return c.json(200, { received: true, pendente: true })
        }
      }

      return concluirCadastro(
        usuario,
        msg,
        {
          valor: interpretado.valor,
          tipo: interpretado.tipo,
          parcelas: interpretado.parcelas,
          recorrente: interpretado.recorrente,
          descricao: descrever(msg.texto),
        },
        cartao,
      )
    }

    /**
     * Conclui o cadastro (vem da mensagem nova ou da resposta à pendência):
     * grava a transação/série e responde confirmando O QUE foi gravado.
     */
    function concluirCadastro(usuario, msg, dados, cartao) {
      const intento = {
        valor: Number(dados.valor) || 0,
        tipo: dados.tipo,
        parcelas: Number(dados.parcelas) || 0,
        recorrente: Boolean(dados.recorrente),
      }
      if (!intento.valor || intento.valor <= 0) {
        registrarMensagem(msg, usuario.id, 'erro', '')
        limparPendencia(msg.from)
        responderWhatsApp(
          msg.from,
          '⚠️ Não consegui identificar o valor da despesa. Tente de novo, ex.: "gastei 50 no uber".',
        )
        return c.json(200, { received: true, erro: true })
      }
      if (intento.tipo !== 'receita' && intento.tipo !== 'despesa') {
        registrarMensagem(msg, usuario.id, 'erro', '')
        limparPendencia(msg.from)
        responderWhatsApp(
          msg.from,
          '⚠️ Não ficou claro se é entrada ou saída. Tente de novo, ex.: "gastei 50 no uber" ou "recebi 1000 de salário".',
        )
        return c.json(200, { received: true, erro: true })
      }

      let transacao = null
      try {
        transacao = gravarTransacao(usuario, msg.texto, intento, cartao)
        if (intento.parcelas > 1) {
          criarParcelasSeguintes(usuario, msg.texto, intento, cartao, transacao)
        }
        console.log(
          '[whatsapp_webhook] transação criada:',
          transacao.id,
          intento.tipo,
          intento.valor,
          intento.parcelas > 1 ? '(em ' + intento.parcelas + 'x)' : '',
          cartao ? '(cartão ' + cartao.getString('nome') + ')' : '(sem cartão)',
          'para',
          usuario.getString('email'),
        )
      } catch (err) {
        console.error('[whatsapp_webhook] falha ao gravar transação:', (err && err.message) || err)
        registrarMensagem(msg, usuario.id, 'erro', '')
        limparPendencia(msg.from)
        responderWhatsApp(
          msg.from,
          '😣 Deu ruim aqui do meu lado e não consegui registrar. Tenta de novo em instantes, por favor.',
        )
        return c.json(200, { received: true, gravada: false })
      }

      registrarMensagem(msg, usuario.id, 'processada', transacao.id)
      limparPendencia(msg.from)

      // Confirmação sempre informando o que foi gravado.
      const rotuloTipo =
        intento.tipo === 'receita' ? '✅ Entrada registrada: R$ ' : '✅ Despesa registrada: R$ '
      let resposta =
        rotuloTipo +
        formatarValor(transacao.getFloat('valor')) +
        ' — ' +
        transacao.getString('descricao')
      if (cartao) resposta += ' no cartão ' + cartao.getString('nome')
      if (intento.parcelas > 1) {
        resposta +=
          ' (parcelado em ' +
          intento.parcelas +
          'x de R$ ' +
          formatarValor(intento.valor / intento.parcelas) +
          ')'
      }
      if (intento.recorrente) resposta += ' — recorrente todo mês'

      responderWhatsApp(msg.from, resposta)
      return c.json(200, { received: true, gravada: true, transacao_id: transacao.id })
    }

    /** Formata valor pt-BR: 1234.5 → "1.234,50". */
    function formatarValor(v) {
      const partes = Number(v).toFixed(2).split('.')
      const inteiro = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.')
      return inteiro + ',' + partes[1]
    }

    return c.json(200, { received: true })
  } catch (err) {
    // Nunca derrubar em 500: a Meta reenviaria e o fluxo travaria.
    console.error('[whatsapp_webhook] erro no POST do webhook:', (err && err.message) || err)
    return c.json(200, { received: true, erro: true })
  }
})

/**
 * Mensagem de boas-vindas pelo WhatsApp no cadastro.
 *
 * Roda depois de o usuário novo ser gravado (afterCreateSuccess do users):
 * se o cadastro trouxe telefone com DDI (+55DDDNUMERO, como o AuthScreen
 * normaliza), envia um TEMPLATE de mensagem da Meta — obrigatório porque a
 * mensagem é iniciada pelo business, fora da janela de 24h do usuário.
 *
 * O template precisa estar criado e APROVADO no painel da Meta (WhatsApp
 * Manager) ANTES de funcionar; o nome dele vem do secret
 * WHATSAPP_WELCOME_TEMPLATE (padrão "boas_vindas_quitafy"). O conteúdo
 * aprovado na Meta deve explicar os planos: VIP R$ 14,99/mês (despesas
 * recorrentes e extratos de todos os meses) e Premium R$ 29,90/mês (imóveis
 * na planta com INCC e interação pelo WhatsApp).
 *
 * O envio é best-effort: falha de rede, template não aprovado ou número sem
 * WhatsApp NUNCA derruba o cadastro — só aparece no log [signup_whatsapp].
 */
$app.onRecordAfterCreateSuccess('users').add((e) => {
  const rec = e.record
  const telefone = String(rec.getString('telefone') || '').trim()
  if (!telefone) {
    console.log('[signup_whatsapp] cadastro sem telefone, pulo envio:', rec.getString('email'))
    return
  }

  // Número no formato da Meta: só dígitos (o AuthScreen grava +55DDDNUMERO).
  const para = telefone.replace(/\D/g, '')
  if (!para) {
    console.log('[signup_whatsapp] telefone sem dígitos, pulo envio:', telefone)
    return
  }

  const email = rec.getString('email')

  // Nome do template via secret WHATSAPP_WELCOME_TEMPLATE, com padrão
  // plausível caso não esteja configurado. O idioma tem que bater com o do
  // template aprovado na Meta (pt_BR para contas brasileiras).
  const nomeTemplate =
    (function lerSecret(nome) {
      try {
        if ($secrets.has(nome)) return $secrets.get(nome)
      } catch (_) {}
      try {
        return $os.getenv(nome) || ''
      } catch (_) {}
      return ''
    })('WHATSAPP_WELCOME_TEMPLATE') || 'boas_vindas_quitafy'

  console.log(
    '[signup_whatsapp] tentando enviar boas-vindas para',
    para,
    'usuário',
    email,
    '(template:',
    nomeTemplate + ')',
  )

  const token = (function lerSecret(nome) {
    try {
      if ($secrets.has(nome)) return $secrets.get(nome)
    } catch (_) {}
    try {
      return $os.getenv(nome) || ''
    } catch (_) {}
    return ''
  })('WHATSAPP_TOKEN')
  const phoneId = (function lerSecret(nome) {
    try {
      if ($secrets.has(nome)) return $secrets.get(nome)
    } catch (_) {}
    try {
      return $os.getenv(nome) || ''
    } catch (_) {}
    return ''
  })('WHATSAPP_PHONE_NUMBER_ID')

  if (!token || !phoneId) {
    console.error(
      '[signup_whatsapp] WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausentes — boas-vindas não enviada',
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
        to: para,
        type: 'template',
        template: {
          name: nomeTemplate,
          language: { code: 'pt_BR' },
        },
      }),
      timeout: 10,
    })

    const statusCode = typeof resp.statusCode === 'number' ? resp.statusCode : 0
    if (statusCode >= 200 && statusCode < 300) {
      console.log('[signup_whatsapp] boas-vindas enviada para', para)
    } else {
      // Falha típica: template inexistente/não aprovado (error.code 132000/
      // 132001), número sem WhatsApp (131026), token vencido. O corpo da
      // Graph API traz o detalhe real da Meta.
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
        '[signup_whatsapp] envio falhou, status_code',
        statusCode,
        '— corpo da Graph API:',
        corpo,
      )
    }
  } catch (err) {
    // Best-effort: nunca derruba o cadastro (o usuário já foi gravado).
    console.error(
      '[signup_whatsapp] erro ao enviar boas-vindas para',
      para,
      ':',
      (err && err.message) || err,
    )
  }
})
