/// <reference path="../pb_data/types.d.ts" />
/**
 * 0028 — Correção da 0027 nesta instância: o campo users.is_admin não chegou
 * a ser criado porque fields.getByName retorna null (em vez de lançar) quando
 * o campo não existe. Esta migração reexecuta aquele passo de forma tolerante
 * e também trava a autoedição de is_admin no updateRule do users (só superuser
 * muda admin — a regra de self-update do usuário não pode deixar isso passar).
 *
 * Idempotente: se o campo já existe e a regra já contém a trava, não faz nada.
 */
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    // 1) campo is_admin — getByName pode devolver null OU lançar; cobrir os dois.
    let temAdmin = false
    try {
      temAdmin = !!users.fields.getByName('is_admin')
    } catch (_) {
      temAdmin = false
    }
    if (!temAdmin) {
      users.fields.add(new BoolField({ name: 'is_admin', required: false }))
      app.save(users)
      console.log('0028: campo users.is_admin criado')
    }

    // 2) updateRule do users não pode permitir que o próprio usuário vire admin.
    const regra = users.updateRule === null ? '' : String(users.updateRule)
    if (regra.indexOf('is_admin:changed') === -1) {
      users.updateRule =
        "@request.auth.id != '' && id = @request.auth.id && @request.body.plan:changed = false && @request.body.is_admin:changed = false"
      app.save(users)
      console.log('0028: updateRule de users com trava de is_admin')
    }

    // 3) dono = admin (mesma lógica de fallback da 0027, reexecutada).
    let jaTemAdmin = false
    try {
      app.findFirstRecordByFilter('users', 'is_admin = true')
      jaTemAdmin = true
    } catch (_) {}
    if (!jaTemAdmin) {
      const ADMIN_TELEFONE = '5511993216607'
      let dono = null
      try {
        const contas = app.findRecordsByFilter(
          'whatsapp_contas',
          `numero = '${ADMIN_TELEFONE}'`,
          '',
          1,
          0,
        )
        if (contas.length > 0) dono = app.findRecordById('users', contas[0].getString('user_id'))
      } catch (_) {
        dono = null
      }
      if (!dono) {
        try {
          dono = app.findFirstRecordByFilter('users', `telefone = '+${ADMIN_TELEFONE}'`)
        } catch (_) {
          dono = null
        }
      }
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
        console.log('0028: usuário dono marcado como admin:', dono.getString('email'))
      } else {
        console.log('0028: nenhum usuário para marcar como admin')
      }
    }
  },
  (app) => {
    // down: nada estrutural a desfazer aqui (a 0027 é quem cria/destrói).
  },
)
