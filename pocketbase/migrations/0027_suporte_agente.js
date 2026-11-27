/// <reference path="../pb_data/types.d.ts" />
/**
 * 0027 — Sistema de suporte (Ajuda) com agente de IA nativo:
 *
 *   1. users.is_admin (bool, default false) — marca o(s) admin(s) que veem a
 *      tela de Atendimentos.
 *   2. Coleção atendimentos — fila de atendimentos escalados pelo agente ao
 *      humano (status aberto/em_atendimento/resolvido, origem app/whatsapp).
 *   3. Coleção atendimentos_mensagens — mensagens de cada atendimento
 *      (autor: cliente/admin/agente).
 *   4. Agente nativo Skip Cloud 'quitafy-suporte' — atende dúvidas sobre o
 *      Quitafy (planos, lançamentos, fechamento de cartão, grupos, imóveis,
 *      arrependimento/cancelamento) e decide quando escalar para um humano:
 *      devolve um JSON de escalonamento em vez de responder chutando.
 *   5. Marca o DONO como is_admin=true (idempotente): o dono usa o número
 *      5511993216607 (whatsapp_contas.numero); como fallback, o usuário mais
 *      antigo do app.
 *
 * Idempotente: tudo é checado antes de criar/alterar — reexecutar não duplica.
 */
migrate(
  (app) => {
    // ---------- 1) users.is_admin ----------
    const users = app.findCollectionByNameOrId('users')
    let temAdmin = false
    try {
      users.fields.getByName('is_admin')
      temAdmin = true
    } catch (_) {
      temAdmin = false
    }
    if (!temAdmin) {
      users.fields.add(new BoolField({ name: 'is_admin', required: false }))
      app.save(users)
      console.log('0027: campo users.is_admin criado')
    }

    // ---------- 2) coleção atendimentos ----------
    if (!app.findCollectionByNameOrId('atendimentos')) {
      const at = new Collection({
        name: 'atendimentos',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null, // tudo via hooks/rotas do servidor
        fields: [
          {
            name: 'usuario',
            type: 'relation',
            required: true,
            collectionId: users.id,
            maxSelect: 1,
          },
          {
            name: 'status',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['aberto', 'em_atendimento', 'resolvido'],
          },
          {
            name: 'origem',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['app', 'whatsapp'],
          },
          { name: 'assunto', type: 'text', required: false, max: 200 },
          { name: 'resumo', type: 'text', required: false, max: 2000 },
        ],
        indexes: [
          'CREATE INDEX idx_atend_usuario ON atendimentos (usuario)',
          'CREATE INDEX idx_atend_status ON atendimentos (status)',
        ],
      })
      app.save(at)
      console.log('0027: coleção atendimentos criada')
    }

    // ---------- 3) coleção atendimentos_mensagens ----------
    const at = app.findCollectionByNameOrId('atendimentos')
    if (!app.findCollectionByNameOrId('atendimentos_mensagens')) {
      const msg = new Collection({
        name: 'atendimentos_mensagens',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null, // tudo via hooks/rotas do servidor
        fields: [
          {
            name: 'atendimento',
            type: 'relation',
            required: true,
            collectionId: at.id,
            maxSelect: 1,
          },
          {
            name: 'autor',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['cliente', 'admin', 'agente'],
          },
          { name: 'texto', type: 'text', required: true, max: 4000 },
        ],
        indexes: ['CREATE INDEX idx_atendmsg_atendimento ON atendimentos_mensagens (atendimento)'],
      })
      app.save(msg)
      console.log('0027: coleção atendimentos_mensagens criada')
    }

    // ---------- 4) agente nativo quitafy-suporte ----------
    $ai.agents.define(app, {
      slug: 'quitafy-suporte',
      name: 'Suporte Quitafy',
      description:
        'Atendente virtual do Quitafy: responde dúvidas sobre a plataforma (planos, lançamentos, cartões, grupos, imóveis, cancelamento) e escala para um atendente humano quando não sabe responder com segurança.',
      tier: 'fast',
      systemPrompt: [
        'Você é o atendente virtual do Quitafy, um app brasileiro de finanças pessoais.',
        'Responda em português do Brasil, de forma cordial, clara e CURTA (até 6 linhas),',
        'sem usar jargão técnico. Você fala SOMENTE sobre o Quitafy; assunto de outro',
        'domínio → peça desculpas e ofereça encaminhar a um atendente humano.',
        '',
        'CONHECIMENTO OFICIAL DO QUITAFY (não invente nada fora disto):',
        '',
        'PLANOS (preços mensais):',
        '- Básico — GRÁTIS: despesas/receitas, cartões de crédito e grupos compartilhados',
        '  com divisão de valores.',
        '- Bronze — R$ 14,99: tudo do Básico + transações recorrentes (aluguel, assinaturas)',
        '  e extratos de meses futuros (planejamento).',
        '- Prata — R$ 24,99: INTERAÇÃO POR WHATSAPP (lançar despesas pelo WhatsApp).',
        '  ESTE PLANO ESTÁ DESATIVADO "em breve": não pode ser assinado agora; quem pedir,',
        '  explique que estará disponível em breve.',
        '- Ouro — R$ 29,99: tudo do Bronze + Imóveis Premium (fluxos de pagamento de imóvel,',
        '  sinal, parcelas anuais/mensais, financiamento) com correção pelo INCC.',
        '',
        'COMO LANÇAR TRANSAÇÕES (no app): botão + na tela principal → escolher Receita ou',
        'Despesa → valor, descrição, categoria, data e cartão (se for no crédito). Campos',
        '"recorrente" (repete todo mês) e "parcelas" (divide a compra em N meses, cada parcela',
        'de valor/N) aparecem na mesma tela.',
        '',
        'FECHAMENTO DO CARTÃO DE CRÉDITO: cada cartão tem um dia de fechamento configurado.',
        'Compras feitas A PARTIR do dia do fechamento NÃO entram na fatura do mês corrente —',
        'caem na fatura do MÊS SEGUINTE. Ex.: cartão fecha dia 5 → compra do dia 5/3 cai na',
        'fatura de abril (competência abril, paga em maio).',
        '',
        'GRUPOS COMPARTILHADOS: em "Grupos" a pessoa cria um grupo e convida por e-mail.',
        'Qualquer lançamento pode ser dividido entre os membros: informe quanto cabe a cada',
        'um na aba de divisão; o valor restante (se sobrar) fica com o dono. Convidados veem',
        'as despesas compartilhadas, mas não editam.',
        '',
        'IMÓVEIS (plano Ouro): em "Imóveis" a pessoa cadastra o imóvel, o mês base do contrato',
        'e os fluxos de pagamento (sinal, parcelas mensais/anuais, financiamento). As parcelas',
        'são corrigidas pelo INCC (índice de construção civil) conforme a defasagem de meses',
        'configurada — o app mostra o valor corrigido e o histórico do índice.',
        '',
        'DIREITO DE ARREPENDIMENTO (CDC, art. 49): em até 7 DIAS do início da assinatura, o',
        'cliente pode cancelar com REEMBOLSO INTEGRAL e o plano volta imediatamente para',
        'Básico. Depois dos 7 dias: cancela apenas a RENOVAÇÃO automática — continua com o',
        'benefício até o fim do período já pago.',
        '',
        'CANCELAMENTO/CONTATO: o cancelamento fica em Planos → sua assinatura. Contato pelo',
        'menu da foto → Contato (WhatsApp do suporte e e-mail contato@quitafy.com.br).',
        '',
        'QUANDO ESCALAR PARA UM HUMANO — responda SOMENTE com este JSON (nada além dele):',
        '{"escalar": true, "resumo": "", "resposta": ""}',
        '  - "resumo": 1 frase com o que o cliente precisa (ex.: "Quer migrar dados de outro app").',
        '  - "resposta": mensagem empática para o cliente IMEDIATAMENTE (ex.: "Registrei seu',
        '    pedido! Um atendente humano vai te responder pelo próprio app em breve 💜").',
        'Escale quando: o cliente PEDIR um atendente humano; a dúvida envolver pagamento,',
        'fatura, reembolso, estorno, bug, reclamação ou dados de OUTRA conta; você não tiver',
        'CERTEZA da resposta com base no conhecimento acima; ou o cliente insistir depois de',
        'sua resposta. NÃO escale para dúvidas simples que o conhecimento acima responde.',
        '',
        'Quando responder normalmente (sem escalar), responda em TEXTO simples (sem JSON),',
        'usando apenas as informações do conhecimento oficial. Se o conhecimento não cobrir,',
        'ESCALE (não chute). Nunca prometa prazos, descontos ou condições que não estão aqui.',
      ].join('\n'),
    })
    console.log('0027: agente quitafy-suporte definido')

    // ---------- 5) dono = admin (idempotente) ----------
    const ADMIN_TELEFONE = '5511993216607'
    let jaTemAdmin = false
    try {
      app.findFirstRecordByFilter('users', 'is_admin = true')
      jaTemAdmin = true
    } catch (_) {}
    if (!jaTemAdmin) {
      let dono = null
      // Caminho principal: número do WhatsApp do dono na coleção whatsapp_contas.
      try {
        const conta = app.findFirstRecordByFilter('whatsapp_contas', `numero = '${ADMIN_TELEFONE}'`)
        dono = app.findRecordById('users', conta.getString('user_id'))
      } catch (_) {
        dono = null
      }
      // Fallback: número com 9 dígito extra (número antigo conhecido do dono).
      if (!dono) {
        try {
          const contas = $app.findRecordsByFilter(
            'whatsapp_contas',
            `numero ~ '${ADMIN_TELEFONE.slice(2)}'`,
            'created',
            1,
            0,
          )
          if (contas.length > 0) {
            dono = app.findRecordById('users', contas[0].getString('user_id'))
          }
        } catch (_) {
          dono = null
        }
      }
      // Segundo fallback: telefone do dono direto no users (o cadastro pede
      // telefone com DDI, ex.: +5511993216607).
      if (!dono) {
        try {
          dono = app.findFirstRecordByFilter('users', `telefone = '+${ADMIN_TELEFONE}'`)
        } catch (_) {
          dono = null
        }
      }
      // Último fallback: o usuário mais antigo (primeiro cadastro do app).
      if (!dono) {
        try {
          const maisAntigos = app.findRecordsByFilter('users', 'id != ""', 'created', 1, 0)
          if (maisAntigos.length > 0) dono = maisAntigos[0]
        } catch (_) {
          dono = null
        }
      }
      if (dono) {
        dono.set('is_admin', true)
        app.save(dono)
        console.log('0027: usuário dono marcado como admin:', dono.getString('email'))
      } else {
        console.log('0027: nenhum usuário encontrado para marcar como admin')
      }
    }
  },
  (app) => {
    // down: remove as coleções de suporte. O agente e o campo is_admin ficam
    // (removê-los poderia apagar o vínculo do dono em futuras reexecuções).
    try {
      app.delete(app.findCollectionByNameOrId('atendimentos_mensagens'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('atendimentos'))
    } catch (_) {}
  },
)
