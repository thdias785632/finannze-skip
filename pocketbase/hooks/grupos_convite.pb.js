/**
 * Convite de grupo por e-mail.
 *
 * Rota: POST /backend/v1/grupos/convidar  { membro_id }
 * O registro em grupos_membros já foi criado pelo front (com status pendente
 * quando o convidado ainda não tem conta). Aqui só enviamos o e-mail —
 * best-effort: falha de envio NUNCA derruba o convite.
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

    $app
      .newMailClient()
      .send(
        $app
          .newEmailMessage()
          .setFrom('Quitafy <no-reply@quitafy.app>')
          .setSubject(assunto)
          .setHtml(corpo.replace(/\n/g, '<br>')),
        email,
      )

    return c.json(200, { success: true, enviado_para: email })
  } catch (err) {
    return c.json(500, { error: err.message || String(err) })
  }
})

/**
 * Vincula convites pendentes quando a pessoa cria a conta: qualquer grupo em
 * que o e-mail dela estava aguardando passa a apontar para o user_id novo
 * (status continua pendente — ela aceita pela aba Grupos).
 */
$app.onRecordAfterCreateSuccess('users').add((e) => {
  const email = String(e.record.email() || '').toLowerCase()
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
