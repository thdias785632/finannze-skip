/**
 * Rota de CADASTRO do Quitafy — POST /backend/v1/auth/registrar
 *
 * Por que esta rota existe: a instância Skip Cloud deste projeto tem um
 * problema COMPROVADO em que callbacks de evento de registro
 * (onRecordAfterCreateSuccess) NÃO executam — provado com hooks de teste
 * (global e tagged 'users') e coleção de diagnóstico vazia, enquanto rotas
 * (routerAdd) funcionam normalmente. Por isso o cadastro inteiro acontece
 * AQUI, inline: valida os campos, cria o usuário na coleção users (plano
 * basico) e envia IMEDIATAMENTE o e-mail de boas-vindas — sem depender de
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
   * HTML + texto puro com os planos Básico / Bronze / Prata / Ouro. Best-effort.
   */
  function enviarBoasVindas(email, nome) {
    // Guia do plano Básico (espelha src/lib/tutorial.ts — fonte única no front;
    // aqui no e-mail é reproduzido em HTML/texto porque a JSVM não lê o front).
    const secoesBasicas = [
      {
        titulo: 'Instale o Quitafy na tela inicial do celular',
        itens: [
          'Android (Chrome): toque no menu ⋮ do navegador, toque em "Adicionar à tela inicial" e confirme em "Instalar" ou "Adicionar".',
          'iPhone/iPad (Safari): toque no botão de compartilhar (o quadrado com seta para cima), toque em "Adicionar à Tela de Início" e confirme em "Adicionar".',
          'Pronto: o ícone do Quitafy aparece junto dos seus apps e abre em tela cheia, como qualquer aplicativo.',
        ],
      },
      {
        titulo: 'Início — seu resumo do mês',
        itens: [
          'O cartão roxo no topo traz o saldo do mês: receitas, despesas e o resultado.',
          'O gráfico de donut mostra quanto você gastou em cada categoria; toque numa fatia para ver os lançamentos daquela categoria.',
          'Os cartões abaixo listam os gastos principais do mês, com valor e porcentagem.',
          'Use a barra inferior (Início, Extrato, +, Cartões, Grupos) para navegar entre as telas.',
        ],
      },
      {
        titulo: 'Nova transação — registre receitas e despesas',
        itens: [
          'Escolha se é entrada (receita) ou saída (despesa) e digite o valor.',
          'Selecione a categoria (moradia, alimentação, transporte...) e a data.',
          'Em "Mais detalhes" você pode vincular a um cartão de crédito ou dividir a despesa num grupo compartilhado.',
          'Toque em "Salvar" — o lançamento aparece na hora no Início e no Extrato.',
        ],
      },
      {
        titulo: 'Extrato — todo o histórico mês a mês',
        itens: [
          'Navegue entre os meses com as setas; o resumo do topo muda junto.',
          'Use o filtro para ver só receitas, só despesas ou uma categoria específica.',
          'Toque num lançamento para editar ou excluir.',
          'No menu do mês você exporta o extrato em PDF para guardar ou enviar.',
          'Meses futuros (previsão de fluxo) são um recurso do plano Bronze.',
        ],
      },
      {
        titulo: 'Cartões — controle de fatura',
        itens: [
          'Toque em "Cartões" na barra inferior e depois em "Adicionar cartão".',
          'Informe nome, bandeira, dia de fechamento e vencimento.',
          'Ao lançar uma despesa, escolha o cartão e a fatura dele é atualizada sozinha.',
          'Na tela do cartão você vê o total da fatura e cada compra que a compõe.',
        ],
      },
      {
        titulo: 'Grupos compartilhados — divida com quem vive com você',
        itens: [
          'Crie um grupo em "Grupos" e convide as pessoas por e-mail.',
          'Cada lançamento do grupo pode indicar quem pagou e como o valor é dividido entre os membros (igual, por valor ou por porcentagem).',
          'A tela do grupo resume o saldo de cada pessoa: quem deve e quem tem a receber.',
          'Os lançamentos do grupo também aparecem no Extrato de quem participou.',
        ],
      },
      {
        titulo: 'Perfil — sua conta, plano e contato',
        itens: [
          'Toque na sua foto no header para abrir o menu do perfil.',
          '"Editar perfil" permite mudar nome, telefone e foto.',
          '"Tutorial" abre este guia, sempre atualizado com o seu plano.',
          '"Planos" mostra o que cada plano inclui e os preços.',
          '"Contato" abre o WhatsApp do suporte (quando disponível) e "Sair" encerra a sessão.',
        ],
      },
    ]

    const htmlGuia = secoesBasicas
      .map(function (secao, i) {
        const itens = secao.itens
          .map(function (item) {
            return '<li style="margin:0 0 6px;">' + item + '</li>'
          })
          .join('')
        return (
          '<li style="margin:0 0 14px;">' +
          '<strong style="font-size:14px;">' +
          (i + 1) +
          '. ' +
          secao.titulo +
          '</strong>' +
          '<ul style="font-size:13px;line-height:1.6;margin:6px 0 0;padding-left:18px;color:#4B5563;">' +
          itens +
          '</ul>' +
          '</li>'
        )
      })
      .join('')

    const html = [
      '<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F1438;max-width:560px;margin:0 auto;padding:24px;">',
      '  <h1 style="font-size:20px;margin:0 0 16px;">🎉 Bem-vindo(a) ao Quitafy, ' +
        nome +
        '!</h1>',
      '  <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">',
      '    Você começou sua jornada pelo plano <strong>Básico</strong> — e ele já inclui controle de',
      '    receitas e despesas, cartões com controle de fatura, categorias com gráfico, o extrato',
      '    do mês atual e dos meses passados e <strong>grupos compartilhados de despesas</strong>:',
      '    divida lançamentos com família e amigos, por pessoa e com quem pagou.',
      '  </p>',
      '  <p style="font-size:14px;line-height:1.6;margin:0 0 12px;">Além dele, temos:</p>',
      '  <ul style="font-size:14px;line-height:1.8;margin:0 0 12px;padding-left:20px;">',
      '    <li><strong>Bronze — R$ 14,99/mês</strong>: tudo do Básico + despesas e receitas recorrentes e extratos de todos os meses (inclusive futuros).</li>',
      '    <li><strong>Prata — R$ 24,99/mês</strong>: tudo do Bronze + lançamentos pelo WhatsApp ("gastei 50 no uber" e pronto).</li>',
      '    <li><strong>Ouro — R$ 29,99/mês</strong>: tudo do Prata + módulo de imóveis na planta com correção pelo INCC.</li>',
      '  </ul>',
      '  <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">',
      '    As informações e preços ficam na seção de <strong>Planos</strong>, dentro do app.',
      '  </p>',
      '  <h2 style="font-size:16px;margin:0 0 10px;">📖 Guia rápido do Básico</h2>',
      '  <p style="font-size:13px;line-height:1.6;margin:0 0 12px;color:#4B5563;">',
      '    Comece por aqui: instale o app na tela inicial e aprenda a usar cada tela.',
      '    No menu da sua foto, o item <strong>Tutorial</strong> traz o guia completo,',
      '    atualizado com o seu plano.',
      '  </p>',
      '  <ul style="font-size:14px;line-height:1.7;margin:0 0 16px;padding-left:20px;">' +
        htmlGuia +
        '</ul>',
      '  <p style="font-size:12px;color:#6B7280;margin:0;">Equipe Quitafy</p>',
      '</div>',
    ].join('')

    const linhasGuia = secoesBasicas
      .map(function (secao, i) {
        return (
          i +
          1 +
          '. ' +
          secao.titulo +
          '\n' +
          secao.itens
            .map(function (item) {
              return '   - ' + item
            })
            .join('\n')
        )
      })
      .join('\n\n')

    const texto = [
      'Bem-vindo(a) ao Quitafy, ' + nome + '!',
      '',
      'Você começou sua jornada pelo plano Básico. Além dele, temos:',
      '- Bronze — R$ 14,99/mês: tudo do Básico + despesas e receitas recorrentes e extratos de todos os meses (inclusive futuros).',
      '- Prata — R$ 24,99/mês: tudo do Bronze + lançamentos pelo WhatsApp ("gastei 50 no uber" e pronto).',
      '- Ouro — R$ 29,99/mês: tudo do Prata + módulo de imóveis na planta com correção pelo INCC.',
      '',
      'As informações e preços ficam na seção de Planos, dentro do app.',
      '',
      '📖 Guia rápido do Básico:',
      linhasGuia,
      '',
      'No menu da sua foto, o item Tutorial traz o guia completo, atualizado com o seu plano.',
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

    // ---- cria o usuário (plano basico) — o mesmo que o endpoint padrão fazia ----
    const col = $app.findCollectionByNameOrId('users')
    const usuario = new Record(col)
    usuario.setEmail(email)
    usuario.setPassword(senha)
    usuario.set('name', nome)
    usuario.set('telefone', telefone)
    usuario.set('plan', 'basico')
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
