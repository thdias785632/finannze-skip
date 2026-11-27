/**
 * Painel admin Quitafy — dados e gestão de usuários (SÓ para is_admin=true).
 *
 * Rotas (todas exigem login + is_admin; 403 caso contrário):
 *   GET  /backend/v1/admin/resumo
 *     Contagens para o Dashboard: total de usuários, novos cadastros
 *     (últimos 7/30 dias), usuários por plano (basico/bronze/ouro/prata) e
 *     atendimentos pendentes (status "aberto").
 *   GET  /backend/v1/admin/usuarios?q=termo
 *     Lista de usuários (nome, e-mail, telefone, plano, is_admin, created),
 *     com busca opcional por nome/e-mail/telefone. Retorna também o número
 *     vinculado em whatsapp_contas de cada um.
 *   POST /backend/v1/admin/usuarios/atualizar
 *     Edita um usuário: nome, telefone (com DDI; sincroniza whatsapp_contas),
 *     plano (basico/bronze/ouro — Prata está desativado) e is_admin.
 *
 * Nota JSVM: todo helper fica INLINE dentro do callback (sem topo compartilhado)
 * e c.auth é PROPRIEDADE — usar `typeof c.auth === 'function' ? c.auth() : c.auth`.
 */

routerAdd('GET', '/backend/v1/admin/resumo', (c) => {
  try {
    const usuario = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!usuario) return c.json(401, { error: 'Faça login' })
    if (usuario.getBool('is_admin') !== true) {
      return c.json(403, { error: 'Acesso restrito ao administrador' })
    }

    const todos = $app.findRecordsByFilter('users', 'id != ""', 'created', 0, 0)
    const total = todos.length

    let ultimos7 = 0
    let ultimos30 = 0
    const agora = new Date().getTime()
    const dia = 24 * 60 * 60 * 1000
    for (const u of todos) {
      const criado = new Date(u.getString('created')).getTime()
      if (isNaN(criado)) continue
      if (agora - criado <= 7 * dia) ultimos7++
      if (agora - criado <= 30 * dia) ultimos30++
    }

    const porPlano = { basico: 0, bronze: 0, prata: 0, ouro: 0 }
    for (const u of todos) {
      const plano = u.getString('plan') || 'basico'
      if (porPlano[plano] === undefined) porPlano[plano] = 0
      porPlano[plano]++
    }

    const pendentes = $app.findRecordsByFilter(
      'atendimentos',
      "status = 'aberto'",
      '-created',
      0,
      0,
    ).length

    return c.json(200, {
      total_usuarios: total,
      novos_7_dias: ultimos7,
      novos_30_dias: ultimos30,
      por_plano: porPlano,
      atendimentos_pendentes: pendentes,
    })
  } catch (err) {
    console.error('[admin] erro no resumo:', (err && err.message) || err)
    return c.json(500, { error: 'Erro ao carregar o resumo' })
  }
})

routerAdd('GET', '/backend/v1/admin/usuarios', (c) => {
  try {
    const usuario = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!usuario) return c.json(401, { error: 'Faça login' })
    if (usuario.getBool('is_admin') !== true) {
      return c.json(403, { error: 'Acesso restrito ao administrador' })
    }

    // Busca opcional por nome/e-mail/telefone — filtro seguro (sem SQL cru).
    let filtro = 'id != ""'
    let termo = ''
    try {
      const info = c.requestInfo()
      termo = String((info.query || {}).q || '')
    } catch (_) {
      termo = ''
    }
    termo = termo.trim()
    if (termo) {
      // Escapa aspas simples para não quebrar o filtro do PocketBase.
      const seguro = termo.replace(/'/g, "''")
      filtro =
        "(name ~ '" + seguro + "' || email ~ '" + seguro + "' || telefone ~ '" + seguro + "')"
    }

    const lista = $app.findRecordsByFilter('users', filtro, '-created', 500, 0)
    const itens = []
    for (const u of lista) {
      let numeroWhats = ''
      try {
        const conta = $app.findFirstRecordByFilter('whatsapp_contas', `user_id = '${u.id}'`)
        numeroWhats = conta.getString('numero') || ''
      } catch (_) {}
      itens.push({
        id: u.id,
        nome: u.getString('name'),
        email: u.getString('email'),
        telefone: u.getString('telefone'),
        plano: u.getString('plan') || 'basico',
        is_admin: u.getBool('is_admin') === true,
        whatsapp_numero: numeroWhats,
        created: u.getString('created'),
        updated: u.getString('updated'),
      })
    }
    return c.json(200, { usuarios: itens })
  } catch (err) {
    console.error('[admin] erro ao listar usuários:', (err && err.message) || err)
    return c.json(500, { error: 'Erro ao carregar usuários' })
  }
})

routerAdd('POST', '/backend/v1/admin/usuarios/atualizar', (c) => {
  // ---- helpers (inline: a JSVM não compartilha topo com callbacks) ----

  /** Normaliza um telefone para "+DDIDDDNUMERO" (mesma regra do cadastro). */
  function normalizarTelefone(bruto) {
    const digitos = String(bruto || '').replace(/\D/g, '')
    if (!digitos) return null
    let ddi = '55'
    let resto = digitos
    if (digitos.startsWith('55') && digitos.length > 11) {
      ddi = '55'
      resto = digitos.slice(2)
    } else if (digitos.length > 11) {
      return '+' + digitos
    }
    if (resto.length < 10 || resto.length > 11) return null
    return '+' + ddi + resto
  }

  try {
    const admin = typeof c.auth === 'function' ? c.auth() : c.auth
    if (!admin) return c.json(401, { error: 'Faça login' })
    if (admin.getBool('is_admin') !== true) {
      return c.json(403, { error: 'Acesso restrito ao administrador' })
    }

    const info = c.requestInfo()
    const corpo = info.body || {}
    const id = String(corpo.id || '').trim()
    if (!id) return c.json(400, { error: 'Usuário não informado' })

    const alvo = $app.findRecordById('users', id)

    // Nome
    if (corpo.nome !== undefined && corpo.nome !== null) {
      const nome = String(corpo.nome).trim()
      if (!nome) return c.json(400, { error: 'O nome não pode ficar vazio' })
      alvo.set('name', nome)
    }

    // Plano: só os ativos (Prata desativado). Nulo/omissão = não mexe.
    if (corpo.plano !== undefined && corpo.plano !== null && String(corpo.plano) !== '') {
      const plano = String(corpo.plano)
      if (['basico', 'bronze', 'ouro'].indexOf(plano) === -1) {
        return c.json(400, {
          error: 'Plano inválido — escolha entre Básico, Bronze e Ouro (Prata está em breve).',
        })
      }
      alvo.set('plan', plano)
    }

    // is_admin: opcional. O admin logado não pode tirar o próprio acesso.
    if (corpo.is_admin !== undefined && corpo.is_admin !== null) {
      const novoEhAdmin = corpo.is_admin === true || corpo.is_admin === 'true'
      if (alvo.id === admin.id && !novoEhAdmin) {
        return c.json(400, { error: 'Você não pode remover seu próprio acesso de admin.' })
      }
      alvo.set('is_admin', novoEhAdmin)
    }

    $app.save(alvo)

    // Telefone: normaliza e sincroniza whatsapp_contas (mesma regra do perfil).
    if (corpo.telefone !== undefined && corpo.telefone !== null && String(corpo.telefone) !== '') {
      const tel = normalizarTelefone(corpo.telefone)
      if (!tel) {
        return c.json(400, {
          error:
            'Telefone inválido — informe com DDI, ex.: +55 (11) 99999-8888 (nada foi alterado).',
        })
      }
      alvo.set('telefone', tel)
      $app.save(alvo)

      const digitosTel = tel.replace(/\D/g, '')
      let conta = null
      try {
        conta = $app.findFirstRecordByFilter('whatsapp_contas', `user_id = '${alvo.id}'`)
      } catch (_) {}
      if (conta) {
        if (conta.getString('numero') !== digitosTel) {
          // O índice único de whatsapp_contas.numero pode recusar se o número
          // já pertencer a outra conta — devolvo o erro para o admin ver.
          try {
            conta.set('numero', digitosTel)
            $app.save(conta)
          } catch (err) {
            return c.json(400, {
              error: 'Usuário atualizado, mas o número não: ele já está vinculado a outra conta.',
            })
          }
        }
      } else {
        try {
          const nova = new Record($app.findCollectionByNameOrId('whatsapp_contas'))
          nova.set('user_id', alvo.id)
          nova.set('numero', digitosTel)
          $app.save(nova)
        } catch (err) {
          console.error('[admin] falha ao criar vínculo WhatsApp:', (err && err.message) || err)
        }
      }
    }

    return c.json(200, {
      ok: true,
      usuario: {
        id: alvo.id,
        nome: alvo.getString('name'),
        email: alvo.getString('email'),
        telefone: alvo.getString('telefone'),
        plano: alvo.getString('plan') || 'basico',
        is_admin: alvo.getBool('is_admin') === true,
        created: alvo.getString('created'),
        updated: alvo.getString('updated'),
      },
    })
  } catch (err) {
    console.error('[admin] erro ao atualizar usuário:', (err && err.message) || err)
    return c.json(500, { error: 'Erro ao atualizar o usuário' })
  }
})
