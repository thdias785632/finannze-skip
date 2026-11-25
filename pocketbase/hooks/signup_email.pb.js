/**
 * E-mail de boas-vindas no cadastro (Quitafy).
 *
 * Quando um usuário novo é gravado na coleção users (afterCreateSuccess),
 * envia um e-mail com as informações dos planos para o endereço do cadastro,
 * usando o cliente SMTP do PocketBase ($app.newMailClient()) — o mesmo padrão
 * do hook de convite de grupos (grupos_convite.pb.js), com o remetente
 * "Quitafy <no-reply@quitafy.com.br>".
 *
 * NÃO iniciamos nenhuma conversa de WhatsApp neste momento — a interação pelo
 * WhatsApp continua existindo, mas só quando o PRÓPRIO usuário manda mensagem
 * (rota do webhook, exclusiva do plano Premium).
 *
 * O envio é best-effort em try/catch: qualquer falha de SMTP NUNCA derruba o
 * cadastro (o usuário já foi gravado) — o resultado é logado com o prefixo
 * [signup_email], incluindo o erro/corpo da resposta quando houver.
 */

$app.onRecordAfterCreateSuccess('users').add((e) => {
  const rec = e.record
  const email = String(rec.getString('email') || '').trim()
  if (!email) {
    console.log('[signup_email] cadastro sem e-mail, pulo envio')
    return
  }
  const nome = String(rec.getString('name') || '').trim() || email.split('@')[0]

  console.log('[signup_email] preparando e-mail de boas-vindas para', email)

  const html = [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F1438;max-width:560px;margin:0 auto;padding:24px;">',
    '  <h1 style="font-size:20px;margin:0 0 16px;">🎉 Bem-vindo(a) ao Quitafy, ' + nome + '!</h1>',
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
    console.log('[signup_email] e-mail de boas-vindas enviado para', email)
  } catch (mailErr) {
    // Best-effort: nunca derruba o cadastro — o usuário já foi gravado.
    console.error(
      '[signup_email] falha ao enviar e-mail de boas-vindas para',
      email,
      ':',
      (mailErr && mailErr.message) || mailErr,
    )
  }
})
