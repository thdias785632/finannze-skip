// 0006: consolida os cartões herdados das contas antigas (0004). Cada usuário
// fica com um único "Cartão de Crédito": as transações são reatribuídas para ele
// e os demais cartões-migrados são removidos. Nomes antigos de exemplo
// ("Nubank", "Carteira", "Black") deixam de existir.
//
// Idempotente: se o usuário já tem apenas cartões com nomes próprios, nada muda.
migrate(
  (app) => {
    const NOMES_HERDADOS = ['Conta Principal', 'Cartão de Crédito Black']

    let users
    try {
      users = app.findRecordsByFilter('users', '', 'created', 0, 0)
    } catch (_) {
      return
    }

    users.forEach((u) => {
      let cartoes
      try {
        cartoes = app.findRecordsByFilter('cartoes', `user_id = '${u.id}'`, 'created', 0, 0)
      } catch (_) {
        return
      }
      if (cartoes.length <= 1) {
        // Ainda renomeia se for um nome herdado das contas antigas
        if (cartoes.length === 1 && NOMES_HERDADOS.includes(cartoes[0].getString('nome'))) {
          cartoes[0].set('nome', 'Cartão de Crédito')
          if (!cartoes[0].getInt('dia_vencimento')) cartoes[0].set('dia_vencimento', 10)
          app.save(cartoes[0])
        }
        return
      }

      const keep = cartoes[0]
      keep.set('nome', 'Cartão de Crédito')
      if (!keep.getInt('dia_vencimento')) keep.set('dia_vencimento', 10)
      app.save(keep)

      cartoes.slice(1).forEach((c) => {
        const txs = app.findRecordsByFilter('transacoes', `cartao_id = '${c.id}'`, 'created', 0, 0)
        txs.forEach((tx) => {
          tx.set('cartao_id', keep.id)
          app.save(tx)
        })
        app.delete(c)
      })
    })
  },
  (app) => {
    // down: nada a desfazer (consolidação de dados)
  },
)
