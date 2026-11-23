/**
 * Convite de grupo por e-mail.
 *
 * Rotas:
 *   POST /backend/v1/grupos/convidar  { membro_id }
 *     O registro em grupos_membros já foi criado pelo front. Se o e-mail
 *     convidado JÁ TEM CONTA no app, o backend vincula o user_id e marca o
 *     membro como aceito NA HORA (a pessoa entra no grupo sem criar conta).
 *     Sem conta, segue pendente: quando a pessoa se cadastrar com esse
 *     e-mail, o hook de cadastro vincula automaticamente.
 *     Aqui também enviamos o e-mail — best-effort: falha de envio NUNCA
 *     derruba o convite.
 *   POST /backend/v1/grupos/convidar  { grupo_id, email }
 *     Alternativa: o backend cria o registro de membro, resolve a conta
 *     existente e envia o e-mail em um passo só.
 */

routerAdd('POST', '/backend/v1/grupos/convidar', (c) => {
  try {
    const info = c.requestInfo()
    const membroId = info.body && info.body.membro_id
    if (!membroId) {
      return c.json(400, { error: "Informe 'membro_id'" })
    }

    const membro = $app.findRecordById('grupos_membros', membroId)
    const grupo = $app.findRecordById('grupos', membro.getString('grupo_id'))
    const email = membro.getString('email')
    if (!email) {
      return c.json(400, { error: 'Convite sem e-mail' })
    }

    // Já tem conta com esse e-mail? Vincula ao grupo na hora — sem depender
    // de a pessoa criar conta ou aceitar alguma coisa depois.
    // Falha aqui NÃO pode derrubar a rota nem impedir o envio do e-mail.
    let jaVinculado = false
    try {
      if (membro.getString('status') !== 'aceito') {
        const alvo = String(email || '')
          .trim()
          .toLowerCase()
        let usuario = null
        if (alvo && alvo.includes('@')) {
          try {
            usuario = $app.findFirstRecordByFilter('users', `email = '${alvo}'`)
          } catch (_) {
            usuario = null
          }
        }
        if (usuario) {
          membro.set('user_id', usuario.id)
          membro.set('nome', String(usuario.getString('name') || membro.getString('nome')))
          membro.set('status', 'aceito')
          $app.save(membro)
          jaVinculado = true
        }
      } else if (membro.getString('user_id') !== '') {
        jaVinculado = true
      }
    } catch (vincErr) {
      console.error(
        `[grupos_convite] falha ao vincular conta existente para ${email} (grupo ${grupo.id}, membro ${membro.id}):`,
        (vincErr && vincErr.message) || vincErr,
      )
    }

    // Quem convidou (dono do grupo) — para assinar o e-mail.
    let donoEmail = ''
    let donoNome = ''
    try {
      const dono = $app.findFirstRecordByFilter(
        'grupos_membros',
        `grupo_id = '${grupo.id}' && papel = 'dono'`,
      )
      donoEmail = dono.getString('email')
      donoNome = dono.getString('nome')
    } catch (_) {}

    const nomeGrupo = grupo.getString('nome') || 'Meu grupo'
    const nomeConvidado = membro.getString('nome') || email.split('@')[0]
    const link = ($os.getenv('SITE_URL') || '').replace(/\/$/, '') || 'https://quitafy.app'
    const jaTemConta = !!membro.getString('user_id')

    const assunto = `${donoNome || donoEmail} convidou você para o grupo "${nomeGrupo}" no Quitafy`
    const corpo = [
      `Olá, ${nomeConvidado}!`,
      '',
      `${donoNome || donoEmail} convidou você para participar do grupo "${nomeGrupo}" no Quitafy.`,
      jaTemConta
        ? 'Você já tem conta no Quitafy: entre no app e o grupo já estará disponível na aba Grupos.'
        : 'Baixe o app e crie sua conta com este e-mail — seu convite será vinculado automaticamente ao cadastro.',
      '',
      link,
      '',
      'Equipe Quitafy',
    ].join('\n')

    // Envio best-effort: se o SMTP falhar, registramos nos logs e seguimos —
    // o convite/membro já está gravado no banco e a rota responde sucesso.
    try {
      // API do PocketBase (JSVM): MailerMessage + $app.newMailClient().send(message).
      // O remetente vai como objeto { address, name } e o destinatário em `to`.
      const mensagem = new MailerMessage({
        from: { address: 'no-reply@quitafy.com.br', name: 'Quitafy' },
        to: [{ address: email }],
        subject: assunto,
        html: corpo.replace(/\n/g, '<br>'),
      })
      $app.newMailClient().send(mensagem)
    } catch (mailErr) {
      console.error(
        `[grupos_convite] falha ao enviar e-mail de convite para ${email} (grupo ${grupo.id}, membro ${membro.id}):`,
        (mailErr && mailErr.message) || mailErr,
      )
    }

    return c.json(200, {
      success: true,
      enviado_para: email,
      ja_tem_conta: jaTemConta,
      vinculado: jaVinculado,
      status: membro.getString('status'),
    })
  } catch (err) {
    console.error(
      '[grupos_convite] erro na rota /backend/v1/grupos/convidar:',
      (err && err.message) || err,
    )
    return c.json(500, { error: err.message || String(err) })
  }
})

/**
 * Vincula convites pendentes quando a pessoa cria a conta: qualquer grupo em
 * que o e-mail dela estava aguardando passa a apontar para o user_id novo
 * (status continua pendente — ela aceita pela aba Grupos).
 */
$app.onRecordAfterCreateSuccess('users').add((e) => {
  const email = String(e.record.getString('email') || '').toLowerCase()
  if (!email) return
  const pendentes = $app.findRecordsByFilter(
    'grupos_membros',
    `status = 'pendente' && user_id = '' && email = '${email}'`,
    '-created',
    50,
    0,
  )
  for (const p of pendentes) {
    p.set('user_id', e.record.id)
    $app.save(p)
  }
})
