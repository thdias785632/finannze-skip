/// <reference path="../pb_data/types.d.ts" />
/**
 * Diagnóstico do cadastro (build v4).
 *
 * Registra em coleção própria cada afterCreateSuccess (global e de signup_email)
 * e cada tentativa de envio de e-mail — prova legível sem depender do stream
 * de logs, que só mostra [whatsapp_webhook].
 */
migrate(
  (app) => {
    const diag = new Collection({
      name: 'diag_logs',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'fonte', type: 'text', max: 100 },
        { name: 'detalhe', type: 'text', max: 2000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
      ],
      indexes: ['CREATE INDEX idx_diag_logs_fonte ON diag_logs (fonte, created DESC)'],
    })
    app.save(diag)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('diag_logs'))
    } catch (_) {}
  },
)
