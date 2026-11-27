/**
 * Suporte Quitafy — chat de Ajuda com o agente nativo e caixa de Atendimentos.
 *
 * Rotas:
 *   POST /backend/v1/ajuda
 *     Cliente logado envia uma dúvida → grava em ajuda_conversas → chama o
 *     agente nativo 'quitafy-suporte' → grava a resposta e a devolve. Quando o
 *     agente responde com ESCALONAR (JSON {escalonar:true,motivo}), cria um
 *     registro em atendimentos (+ primeira mensagem) e avisa o dono.
 *   GET  /backend/v1/ajuda/historico
 *     Histórico da conversa de ajuda do usuário logado (ajuda_conversas).
 *   GET  /backend/v1/atendimentos
 *     Lista de atendimentos abertos — SÓ usuários com is_admin=true.
 *   POST /backend/v1/atendimentos/responder
 *     Admin responde um atendimento: grava a mensagem, marca o atendimento
 *     como respondido e envia a resposta pelo WhatsApp da conta do app para o
 *     número do cliente (janela de 24h da Meta).
 *
 * Número do dono (admin) para notificações: secret/constante
 * WHATSAPP_DONO_NUMERO (default 5511993216607). Se o envio no WhatsApp falhar,
 * a notificação sai por E-MAIL como segunda via.
 *
 * Nota JSVM do PocketBase: callbacks de routerAdd NÃO enxergam declarações de
 * topo — todos os helpers ficam inline dentro do próprio callback. c.auth é
 * PROPRIEDADE (objeto record), não método: usar
 * `typeof c.auth === 'function' ? c.auth() : c.auth`.
 * Resposta de $http.send: { statusCode, json, raw, body(bytes) } — sem
 * campo "status".
 */

routerAdd('POST', '/backend/v1/ajuda', (c) => {
  const DONO_NUMERO = (function lerSecret(nome, def) {
    try {
      if ($secrets.has(nome)) return $secrets.get(nome) || def
    } catch (_) {}
    try {
      return $os.getenv(nome) || def
    } catch (_) {
      return def
    }
  })('WHATSAPP_DONO_NUMERO', '5511993216607')

  /** Autenticação: registro do usuário ou null. */
  function usuarioAtual() {
    try {
      return typeof c.auth === 'function' ? c.auth() : c.auth
    } catch (_) {
      return null
    }
  }

  /** Histórico recente da conversa de ajuda do usuário (para contexto). */
  function historicoRecente(userId) {
    const msgs = []
    try {
      const lista = $app.findRecordsByFilter(
        'ajuda_conversas',
        `user_id = '${userId}'`,
        'created',
        20,
        0,
      )
      for (const r of lista) {
        msgs.push({ papel: r.getString('papel'), texto: r.getString('texto') })
      }
    } catch (_) {}
    return msgs
  }

  /** Grava uma mensagem da conversa de ajuda. */
  function gravarConversa(userId, papel, texto) {
    try {
      const rec = new Record($app.findCollectionByNameOrId('ajuda_conversas'))
      rec.set('user_id', userId)
      rec.set('papel', papel)
      rec.set('texto', String(texto || '').substring(0, 4000))
      $app.save(rec)
      return rec
    } catch (err) {
      console.error('[suporte] falha ao gravar conversa:', (err && err.message) || err)
      return null
    }
  }

  /**
   * Envia mensagem de WhatsApp pela conta do app (best-effort). Devolve true
   * quando a Graph API aceitou (2xx).
   */
  function enviarWhatsApp(numero, texto) {
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
      console.error('[suporte] WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausentes — envio pulado')
      return false
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
      const statusCode = typeof resp.statusCode === 'number' ? resp.statusCode : 0
      if (statusCode >= 200 && statusCode < 300) {
        console.log('[suporte] WhatsApp enviado para', numero)
        return true
      }
      let corpo = ''
      try {
        if (resp.json !== undefined && resp.json !== null) corpo = JSON.stringify(resp.json)
      } catch (_) {}
      console.error('[suporte] WhatsApp falhou, status', statusCode, '—', corpo || '(sem corpo)')
      return false
    } catch (err) {
      console.error('[suporte] erro de envio no WhatsApp:', (err && err.message) || err)
      return false
    }
  }

  /** E-mail best-effort (segunda via quando o WhatsApp falha). */
  function enviarEmailParaAdmin(assunto, corpoTexto) {
    try {
      const admin = $app.findFirstRecordByFilter('users', 'is_admin = true')
      const email = admin.getString('email')
      const mensagem = new MailerMessage({
        from: { address: 'no-reply@quitafy.com.br', name: 'Quitafy' },
        to: [{ address: email }],
        subject: assunto,
        text: corpoTexto,
      })
      $app.newMailClient().send(mensagem)
      console.log('[suporte] e-mail de escalonamento enviado para', email)
      return true
    } catch (err) {
      console.error('[suporte] falha ao enviar e-mail ao admin:', (err && err.message) || err)
      return false
    }
  }

  /** Cria o atendimento + primeira mensagem e notifica o dono. */
  function abrirAtendimento(usuario, pergunta, motivo) {
    let atendimento = null
    try {
      atendimento = new Record($app.findCollectionByNameOrId('atendimentos'))
      atendimento.set('user_id', usuario.id)
      atendimento.set('status', 'aberto')
      atendimento.set('canal', 'whatsapp')
      atendimento.set('assunto', String(pergunta || '').substring(0, 200))
      atendimento.set('motivo_escalonamento', String(motivo || '').substring(0, 500))
      $app.save(atendimento)
      const msg = new Record($app.findCollectionByNameOrId('atendimentos_mensagens'))
      msg.set('atendimento_id', atendimento.id)
      msg.set('autor_id', usuario.id)
      msg.set('autor_papel', 'cliente')
      msg.set('texto', String(pergunta || '').substring(0, 4000))
      $app.save(msg)
      console.log('[suporte] atendimento aberto:', atendimento.id)
    } catch (err) {
      console.error('[suporte] falha ao abrir atendimento:', (err && err.message) || err)
      return
    }
    const nomeCliente = usuario.getString('name') || usuario.getString('email')
    const aviso =
      '🔔 Quitafy: novo atendimento que precisa de você.\n\n' +
      'Cliente: ' +
      nomeCliente +
      '\n' +
      'Assunto: ' +
      String(pergunta || '').substring(0, 300) +
      '\n\n' +
      'Responda na tela Atendimentos do app (visível só para admin).'
    const okWhats = enviarWhatsApp(DONO_NUMERO, aviso)
    if (!okWhats) {
      console.log('[suporte] WhatsApp do dono falhou — envio por e-mail como segunda via')
      enviarEmailParaAdmin(
        'Quitafy — novo atendimento de ' + nomeCliente,
        'Um cliente abriu um atendimento no Quitafy:\n\nCliente: ' +
          nomeCliente +
          '\nAssunto: ' +
          String(pergunta || '').substring(0, 800) +
          '\n\nResponda na tela Atendimentos do app.',
      )
    }
  }

  // ---- fluxo da rota ----
  try {
    const usuario = usuarioAtual()
    if (!usuario) return c.json(401, { error: 'Faça login para usar a ajuda' })

    const info = c.requestInfo()
    const texto = String((info.body || {}).mensagem || '').trim()
    if (!texto) return c.json(400, { error: 'Escreva sua dúvida' })

    const userId = usuario.id
    gravarConversa(userId, 'cliente', texto)

    const historico = historicoRecente(userId)
    const contexto =
      'Dúvida do cliente: ' +
      JSON.stringify(texto) +
      '\nHistórico recente desta conversa de ajuda (mais novo por último): ' +
      JSON.stringify(
        historico.map(function (m) {
          return (m.papel === 'cliente' ? 'cliente: ' : 'atendente: ') + m.texto
        }),
      )

    let resposta = ''
    try {
      // Runtime do agente exige user_id real; sem conversation_id a cada
      // chamada o histórico já vai no prompt (acima).
      const result = $ai.agent('quitafy-suporte').chat({
        user_id: userId,
        message: contexto,
      })
      resposta = String((result && result.content) || '')
      if (!resposta) {
        console.error('[suporte] agente devolveu sem content:', JSON.stringify(result))
      }
    } catch (err) {
      console.error('[suporte] chamada ao agente falhou:', (err && err.message) || err)
    }

    if (!resposta) {
      resposta =
        '⚠️ Não consegui responder agora. Vou registrar sua dúvida para o time te responder ' +
        'por aqui mesmo — pode deixar que alguém entra em contato.'
      gravarConversa(userId, 'agente', resposta)
      abrirAtendimento(usuario, texto, 'O agente de IA não conseguiu responder')
      return c.json(200, { resposta: resposta, escalonado: true })
    }

    // Escalonamento: o agente pode responder com JSON {escalonar:true,motivo}.
    let escalonar = false
    let motivo = ''
    try {
      const ini = resposta.indexOf('{')
      const fim = resposta.lastIndexOf('}')
      if (ini !== -1 && fim > ini) {
        const parsed = JSON.parse(resposta.substring(ini, fim + 1))
        if (parsed && (parsed.escalonar === true || parsed.escalate === true)) {
          escalonar = true
          motivo = String(parsed.motivo || parsed.reason || '')
          resposta = String(parsed.mensagem_ao_cliente || '') || resposta
        }
      }
    } catch (_) {
      /* resposta normal de texto */
    }

    gravarConversa(userId, 'agente', resposta)

    if (escalonar) {
      abrirAtendimento(usuario, texto, motivo)
    }

    return c.json(200, { resposta: resposta, escalonado: escalonar })
  } catch (err) {
    console.error('[suporte] erro na rota /ajuda:', (err && err.message) || err)
    return c.json(500, { error: 'Erro ao processar sua dúvida' })
  }
})

routerAdd('GET', '/backend/v1/ajuda/historico', (c) => {
  try {
    const usuario = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!usuario) return c.json(401, { error: 'Faça login para ver o histórico' })

    const lista = $app.findRecordsByFilter(
      'ajuda_conversas',
      `user_id = '${usuario.id}'`,
      'created',
      100,
      0,
    )
    const mensagens = lista.map(function (r) {
      return {
        id: r.id,
        papel: r.getString('papel'),
        texto: r.getString('texto'),
        created: r.getString('created'),
      }
    })
    return c.json(200, { mensagens: mensagens })
  } catch (err) {
    console.error('[suporte] erro no histórico de ajuda:', (err && err.message) || err)
    return c.json(500, { error: 'Erro ao carregar o histórico' })
  }
})

routerAdd('GET', '/backend/v1/atendimentos', (c) => {
  try {
    const usuario = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!usuario) return c.json(401, { error: 'Faça login' })
    if (usuario.getBool('is_admin') !== true) {
      return c.json(403, { error: 'Acesso restrito ao administrador' })
    }

    // Join manual (JSVM não tem query com JOIN em findRecordsByFilter):
    // monto a lista com o nome do cliente e a última mensagem de cada um.
    const lista = $app.findRecordsByFilter('atendimentos', 'id != ""', '-created', 100, 0)
    const itens = []
    for (const at of lista) {
      const clienteId = at.getString('user_id')
      let nomeCliente = ''
      let numeroCliente = ''
      try {
        const cli = $app.findRecordById('users', clienteId)
        nomeCliente = cli.getString('name') || cli.getString('email')
        numeroCliente = cli.getString('telefone') || ''
      } catch (_) {}
      if (!numeroCliente) {
        try {
          const conta = $app.findFirstRecordByFilter('whatsapp_contas', `user_id = '${clienteId}'`)
          numeroCliente = conta.getString('numero') || ''
        } catch (_) {}
      }
      let ultima = ''
      let totalMsgs = 0
      try {
        const msgs = $app.findRecordsByFilter(
          'atendimentos_mensagens',
          `atendimento_id = '${at.id}'`,
          'created',
          50,
          0,
        )
        totalMsgs = msgs.length
        if (msgs.length > 0) ultima = msgs[msgs.length - 1].getString('texto')
      } catch (_) {}
      itens.push({
        id: at.id,
        status: at.getString('status'),
        canal: at.getString('canal'),
        assunto: at.getString('assunto'),
        motivo_escalonamento: at.getString('motivo_escalonamento'),
        cliente: nomeCliente,
        cliente_id: clienteId,
        cliente_telefone: numeroCliente,
        ultima_mensagem: ultima,
        total_mensagens: totalMsgs,
        created: at.getString('created'),
        updated: at.getString('updated'),
      })
    }
    return c.json(200, { atendimentos: itens })
  } catch (err) {
    console.error('[suporte] erro na listagem de atendimentos:', (err && err.message) || err)
    return c.json(500, { error: 'Erro ao carregar atendimentos' })
  }
})

routerAdd('GET', '/backend/v1/atendimentos/{id}', (c) => {
  try {
    const usuario = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!usuario) return c.json(401, { error: 'Faça login' })
    if (usuario.getBool('is_admin') !== true) {
      return c.json(403, { error: 'Acesso restrito ao administrador' })
    }

    let id = ''
    try {
      id = String(c.request.pathValue('id') || '')
    } catch (_) {
      id = ''
    }
    if (!id) return c.json(400, { error: 'Atendimento não informado' })

    const at = $app.findRecordById('atendimentos', id)
    const clienteId = at.getString('user_id')
    let nomeCliente = ''
    let numeroCliente = ''
    try {
      const cli = $app.findRecordById('users', clienteId)
      nomeCliente = cli.getString('name') || cli.getString('email')
      numeroCliente = cli.getString('telefone') || ''
    } catch (_) {}
    if (!numeroCliente) {
      try {
        const conta = $app.findFirstRecordByFilter('whatsapp_contas', `user_id = '${clienteId}'`)
        numeroCliente = conta.getString('numero') || ''
      } catch (_) {}
    }
    const msgs = $app.findRecordsByFilter(
      'atendimentos_mensagens',
      `atendimento_id = '${id}'`,
      'created',
      100,
      0,
    )
    return c.json(200, {
      id: at.id,
      status: at.getString('status'),
      assunto: at.getString('assunto'),
      motivo_escalonamento: at.getString('motivo_escalonamento'),
      cliente: nomeCliente,
      cliente_id: clienteId,
      cliente_telefone: numeroCliente,
      created: at.getString('created'),
      mensagens: msgs.map(function (r) {
        return {
          id: r.id,
          autor_papel: r.getString('autor_papel'),
          autor_id: r.getString('autor_id'),
          texto: r.getString('texto'),
          created: r.getString('created'),
        }
      }),
    })
  } catch (err) {
    console.error('[suporte] erro no detalhe do atendimento:', (err && err.message) || err)
    return c.json(404, { error: 'Atendimento não encontrado' })
  }
})

routerAdd('POST', '/backend/v1/atendimentos/responder', (c) => {
  // ---- helpers inline (a JSVM não compartilha topo com callbacks) ----

  function enviarWhatsApp(numero, texto) {
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
      console.error('[suporte] WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID ausentes — envio pulado')
      return false
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
      const statusCode = typeof resp.statusCode === 'number' ? resp.statusCode : 0
      if (statusCode >= 200 && statusCode < 300) {
        console.log('[suporte] resposta enviada para', numero)
        return true
      }
      let corpo = ''
      try {
        if (resp.json !== undefined && resp.json !== null) corpo = JSON.stringify(resp.json)
      } catch (_) {}
      console.error('[suporte] resposta falhou, status', statusCode, '—', corpo || '(sem corpo)')
      return false
    } catch (err) {
      console.error('[suporte] erro de envio no WhatsApp:', (err && err.message) || err)
      return false
    }
  }

  try {
    const usuario = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!usuario) return c.json(401, { error: 'Faça login' })
    if (usuario.getBool('is_admin') !== true) {
      return c.json(403, { error: 'Acesso restrito ao administrador' })
    }

    const info = c.requestInfo()
    const corpo = info.body || {}
    const id = String(corpo.atendimento_id || '').trim()
    const texto = String(corpo.mensagem || '').trim()
    if (!id || !texto) {
      return c.json(400, { error: 'Informe o atendimento e a mensagem' })
    }

    const at = $app.findRecordById('atendimentos', id)

    // Número do cliente: telefone do cadastro (DDI) → whatsapp_contas.
    const clienteId = at.getString('user_id')
    let numeroCliente = ''
    try {
      const cli = $app.findRecordById('users', clienteId)
      numeroCliente = String(cli.getString('telefone') || '').replace(/\D/g, '')
    } catch (_) {}
    if (!numeroCliente) {
      try {
        const conta = $app.findFirstRecordByFilter('whatsapp_contas', `user_id = '${clienteId}'`)
        numeroCliente = conta.getString('numero') || ''
      } catch (_) {}
    }
    if (!numeroCliente) {
      return c.json(400, { error: 'Cliente sem número de WhatsApp cadastrado' })
    }

    // A Meta só aceita mensagens livres dentro da janela de 24h da última
    // interação do cliente. Não tenho o timestamp exato da última mensagem
    // dele aqui (o webhook não grava quando), então o envio é best-effort: se
    // a Graph API recusar (erro 131047/131026 - janela fechada), o admin vê o
    // aviso e o cliente é contatado pelo WhatsApp do próprio suporte.
    const okEnvio = enviarWhatsApp(numeroCliente, texto)

    // Grava a mensagem do admin (independente do envio — o histórico fica).
    const msg = new Record($app.findCollectionByNameOrId('atendimentos_mensagens'))
    msg.set('atendimento_id', at.id)
    msg.set('autor_id', usuario.id)
    msg.set('autor_papel', 'admin')
    msg.set('texto', texto.substring(0, 4000))
    $app.save(msg)

    at.set('status', 'respondido')
    at.set('respondido_em', new Date().toISOString().replace('T', ' ').substring(0, 19) + 'Z')
    $app.save(at)

    if (!okEnvio) {
      return c.json(200, {
        ok: true,
        whatsapp_entregue: false,
        aviso:
          'A resposta foi gravada, mas o WhatsApp não aceitou o envio. A janela de 24h do ' +
          'cliente pode estar fechada — entre em contato pelo WhatsApp do suporte ou aguarde ' +
          'o cliente mandar uma mensagem para reabrir a janela.',
      })
    }
    return c.json(200, { ok: true, whatsapp_entregue: true })
  } catch (err) {
    console.error('[suporte] erro ao responder atendimento:', (err && err.message) || err)
    return c.json(500, { error: 'Erro ao responder o atendimento' })
  }
})
