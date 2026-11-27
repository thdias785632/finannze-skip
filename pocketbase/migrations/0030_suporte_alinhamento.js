/// <reference path="../pb_data/types.d.ts" />
/**
 * 0030 — Alinhamento das coleções de suporte com o código (suporte.pb.js):
 *
 *   1. created/updated (autodate) em atendimentos e atendimentos_mensagens —
 *      as telas e rotas ordenam por "created" e sem o campo a listagem falha
 *      com `invalid sort field "created"` (erro visto nos logs do backend).
 *   2. status de atendimentos ganha o valor "respondido" (usado ao responder).
 *   3. Campo canal (app/whatsapp) e motivo_escalonamento em atendimentos.
 *   4. Campo respondido_em (date) em atendimentos.
 *   5. Cria ajuda_conversas (histórico do chat de Ajuda) — não existia nesta
 *      instância, e as rotas /ajuda dependem dela.
 *
 * Idempotente: cada passo checa antes de criar/alterar.
 */
migrate(
  (app) => {
    function existeColecao(nome) {
      try {
        app.findCollectionByNameOrId(nome)
        return true
      } catch (_) {
        return false
      }
    }

    // ---------- 1) created/updated nas duas coleções ----------
    const pares = ['atendimentos', 'atendimentos_mensagens']
    for (const nome of pares) {
      if (!existeColecao(nome)) continue
      const col = app.findCollectionByNameOrId(nome)
      let mudou = false
      for (const campo of ['created', 'updated']) {
        let existe = false
        try {
          existe = !!col.fields.getByName(campo)
        } catch (_) {
          existe = false
        }
        if (!existe) {
          col.fields.add(
            new AutodateField({
              name: campo,
              onCreate: true,
              onUpdate: campo === 'updated',
            }),
          )
          mudou = true
        }
      }
      if (mudou) {
        app.save(col)
        console.log('0030: created/updated adicionados em', nome)
      }
    }

    // ---------- 2..4) atendimentos: status.respondido, canal, resumo extras ----------
    if (existeColecao('atendimentos')) {
      const at = app.findCollectionByNameOrId('atendimentos')

      const st = at.fields.getByName('status')
      if (st && st.values && st.values.indexOf('respondido') === -1) {
        st.values = st.values.concat(['respondido'])
        app.save(at)
        console.log('0030: status "respondido" adicionado em atendimentos')
      }

      let temCanal = false
      let temMotivo = false
      let temRespondidoEm = false
      try {
        temCanal = !!at.fields.getByName('canal')
      } catch (_) {}
      try {
        temMotivo = !!at.fields.getByName('motivo_escalonamento')
      } catch (_) {}
      try {
        temRespondidoEm = !!at.fields.getByName('respondido_em')
      } catch (_) {}

      if (!temCanal) {
        at.fields.add(
          new SelectField({
            name: 'canal',
            required: false,
            maxSelect: 1,
            values: ['app', 'whatsapp'],
          }),
        )
        app.save(at)
        console.log('0030: campo canal adicionado em atendimentos')
      }
      if (!temMotivo) {
        at.fields.add(new TextField({ name: 'motivo_escalonamento', required: false, max: 500 }))
        app.save(at)
        console.log('0030: campo motivo_escalonamento adicionado em atendimentos')
      }
      if (!temRespondidoEm) {
        at.fields.add(new DateField({ name: 'respondido_em', required: false }))
        app.save(at)
        console.log('0030: campo respondido_em adicionado em atendimentos')
      }
    }

    // ---------- 5) ajuda_conversas ----------
    if (!existeColecao('ajuda_conversas')) {
      const users = app.findCollectionByNameOrId('users')
      const conversa = new Collection({
        name: 'ajuda_conversas',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null, // tudo via hooks/rotas do servidor
        fields: [
          {
            name: 'user_id',
            type: 'relation',
            required: true,
            collectionId: users.id,
            maxSelect: 1,
          },
          {
            name: 'papel',
            type: 'select',
            required: true,
            maxSelect: 1,
            values: ['cliente', 'agente'],
          },
          { name: 'texto', type: 'text', required: true, max: 4000 },
        ],
        indexes: ['CREATE INDEX idx_ajudaconv_user ON ajuda_conversas (user_id)'],
      })
      // Base coleções exigem created/updated explícitos (senão sort/filter
      // falha com invalid sort field "created", igual às outras coleções).
      const fCreated = conversa.fields.getByName('created')
      if (!fCreated) {
        conversa.fields.add(new AutodateField({ name: 'created', onCreate: true, onUpdate: false }))
      }
      const fUpdated = conversa.fields.getByName('updated')
      if (!fUpdated) {
        conversa.fields.add(new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }))
      }
      app.save(conversa)
      console.log('0030: coleção ajuda_conversas criada')
    }
  },
  (app) => {
    // down: nada a desfazer (os campos extras são aditivos e inofensivos).
  },
)
