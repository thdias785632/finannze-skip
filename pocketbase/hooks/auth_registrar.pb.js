/**
 * Rota de CADASTRO do Quitafy — POST /backend/v1/auth/registrar
 *
 * Por que esta rota existe: a instância Skip Cloud deste projeto tem um
 * problema COMPROVADO em que callbacks de evento de registro
 * (onRecordAfterCreateSuccess) NÃO executam — provado com hooks de teste
 * (global e tagged 'users') e coleção de diagnóstico vazia, enquanto rotas
 * (routerAdd) funcionam normalmente. Por isso o cadastro inteiro acontece
 * AQUI, inline: valida os campos, cria o usuário na coleção users (plano
 * free) e envia IMEDIATAMENTE o e-mail de boas-vindas — sem depender de
 * NENHUM hook de evento.
 *
 * Corpo esperado (JSON): { nome, email, senha, telefone }
 *   - telefone já vem normalizado do front no formato +55DDDNUMERO.
 *
 * Resposta de sucesso (200): { user: { id, email, name, plan, telefone } }
 * Erros (400/409/500): { error: "mensagem" }
 *
 * O envio do e-mail é best-effort em try/catch: falha de SMTP NUNCA derruba
 * o cadastro (o usuário já foi gravado) — o resultado é logado com o prefixo
 * [registrar].
 *
 * Regra da JSVM do PocketBase: TODO helper fica INLINE dentro do callback do
 * routerAdd — declarações de topo não são enxergadas ("Hook scoping error").
 */

routerAdd('POST', '/backend/v1/auth/registrar', (c) => {
  // ---- helpers (inline: a JSVM não compartilha topo com callbacks) ----

  /** Lê o JSON `dados` de um campo texto com fallback seguro. */
  function extraiCampo(info, nome) {
    const body = (info && info.body) || {}
    const valor = String(body[nome] === undefined || body[nome] === null ? '' : body[nome]).trim()
    return valor
  }

  /** Resposta de erro JSON padronizada. */
  function erro(c, status, mensagem) {
    console.error('[registrar] erro ' + status + ': ' + mensagem)
    return c.json(status, { error: mensagem })
  }

  /**
   * Envia o e-mail de boas-vindas (mesmo conteúdo do antigo hook
   * signup_email.pb.js): remetente "Quitafy <no-reply@quitafy.com.br>",
   * HTML + texto puro com os planos Free / VIP / Premium. Best-effort.
   */
  function enviarBoasVindas(email, nome) {
    const html = [
      '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F1438;max-width:560px;margin:0 auto;padding:24px;">',
      '  <h1 style="font-size:20px;margin:0 0 16px;">🎉 Bem-vindo(a) ao Quitafy, ' +
        nome +
        '!</h1>',
      '  <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">',
      '    Você começou sua jornada pelo plano <strong>Free</strong> — e ele já inclui controle de',
      '    receitas e despesas, cartões com controle de fatura, categorias com gráfico e o extrato',
      '    do mês atual e dos meses passados.',
      '  </p>',
      '  <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">Além dele, temos:</p>',
      '  <ul style="font-size:14px;line-height:1.8;margin:0 0 12px;padding-left:20px;">',
      '    <li><strong>VIP — R$ 14,99/mês</strong>: despesas e receitas recorrentes e extratos de todos os meses (inclusive futuros).</li>',
      '    <li><strong>Premium — R$ 29,90/mês</strong>: tudo do VIP + acompanhamento de imóveis na planta com correção pelo INCC e interação pelo WhatsApp.</li>',
      '  </ul>',
      '  <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">',
      '    As informações e preços ficam na seção de <strong>Planos</strong>, dentro do app.',
      '  </p>',
      '  <p style="font-size:12px;color:#6B7280;margin:0;">Equipe Quitafy</p>',
      '</div>',
    ].join('')

    const texto = [
      'Bem-vindo(a) ao Quitafy, ' + nome + '!',
      '',
      'Você começou sua jornada pelo plano Free. Além dele, temos:',
      '- VIP — R$ 14,99/mês: despesas e receitas recorrentes e extratos de todos os meses (inclusive futuros).',
      '- Premium — R$ 29,90/mês: tudo do VIP + acompanhamento de imóveis na planta com correção pelo INCC e interação pelo WhatsApp.',
      '',
      'As informações e preços ficam na seção de Planos, dentro do app.',
      '',
      'Equipe Quitafy',
    ].join('\n')

    try {
      // API do PocketBase (JSVM): MailerMessage + $app.newMailClient().send(message).
      const mensagem = new MailerMessage({
        from: { address: 'no-reply@quitafy.com.br', name: 'Quitafy' },
        to: [{ address: email }],
        subject: '🎉 Bem-vindo(a) ao Quitafy!',
        html: html,
        text: texto,
      })
      $app.newMailClient().send(mensagem)
      console.log('[registrar] e-mail de boas-vindas enviado para', email)
    } catch (mailErr) {
      // Best-effort: nunca derruba o cadastro — o usuário já foi gravado.
      console.error(
        '[registrar] falha ao enviar e-mail de boas-vindas para',
        email,
        ':',
        (mailErr && mailErr.message) || mailErr,
      )
    }
  }

  // ---- fluxo da rota ----

  try {
    const info = c.requestInfo()
    const nome = extraiCampo(info, 'nome')
    const email = extraiCampo(info, 'email').toLowerCase()
    const senha = String((info.body || {}).senha === undefined ? '' : (info.body || {}).senha)
    const telefone = extraiCampo(info, 'telefone')

    console.log('[registrar] cadastro recebido para', email, '— build v1')

    // ---- validações ----
    if (!nome) return erro(c, 400, 'Informe seu nome completo')
    if (!email || email.indexOf('@') < 0 || email.indexOf('.') < 0) {
      return erro(c, 400, 'Informe um e-mail válido')
    }
    if (!senha || senha.length < 8) {
      return erro(c, 400, 'A senha deve ter no mínimo 8 caracteres')
    }
    if (!telefone || !/^\+\d{10,15}$/.test(telefone)) {
      return erro(c, 400, 'Informe um telefone válido com DDI, ex.: +5511999998888')
    }

    // E-mail único: o mesmo que o endpoint padrão validava.
    try {
      $app.findAuthRecordByEmail('_pb_users_auth_', email)
      return erro(c, 409, 'Já existe uma conta com este e-mail')
    } catch (_) {
      /* não existe — sigo */
    }

    // Telefone presente e (quando possível) não usado por outra conta.
    try {
      const existentes = $app.findRecordsByFilter(
        'users',
        "telefone = '" + telefone.replace(/'/g, "''") + "'",
        '',
        1,
        0,
      )
      if (existentes.length > 0) {
        return erro(c, 409, 'Este telefone já está cadastrado em outra conta')
      }
    } catch (_) {
      /* sem vínculo existente — sigo */
    }

    // ---- cria o usuário (plano free) — o mesmo que o endpoint padrão fazia ----
    const col = $app.findCollectionByNameOrId('users')
    const usuario = new Record(col)
    usuario.setEmail(email)
    usuario.setPassword(senha)
    usuario.set('name', nome)
    usuario.set('telefone', telefone)
    usuario.set('plan', 'free')
    usuario.setVerified(true)
    $app.save(usuario)
    console.log('[registrar] usuário criado:', usuario.id, email)

    // ---- boas-vindas por e-mail, IMEDIATAMENTE e inline (sem hook de evento) ----
    enviarBoasVindas(email, nome)

    return c.json(200, {
      user: {
        id: usuario.id,
        email: usuario.getString('email'),
        name: usuario.getString('name'),
        plan: usuario.getString('plan'),
        telefone: usuario.getString('telefone'),
      },
    })
  } catch (err) {
    console.error('[registrar] falha no cadastro:', (err && err.message) || err)
    return c.json(500, { error: 'Não foi possível criar a conta. Tente novamente.' })
  }
})
