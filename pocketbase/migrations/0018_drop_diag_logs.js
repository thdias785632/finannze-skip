// Remove a coleção diag_logs (migração 0017) — o diagnóstico do bug do
// cadastro terminou (a solução foi mover o cadastro para a rota
// POST /backend/v1/auth/registrar, em pb_hooks/auth_registrar.pb.js).
// Migração 0017 já está aplicada: o histórico não é tocado, esta nova
// migração apenas derruba a coleção.
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('diag_logs')
    app.delete(col)
  },
  (app) => {
    // Reverte: recria a coleção como a 0017 a tinha deixado.
    const collection = new Collection({
      name: 'diag_logs',
      type: 'base',
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'fonte', type: 'text' },
        { name: 'detalhe', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_diag_logs_fonte ON diag_logs (fonte)'],
    })
    app.save(collection)
  },
)
