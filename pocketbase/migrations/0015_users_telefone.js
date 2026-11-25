migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('telefone')) {
      users.fields.add(new TextField({ name: 'telefone', max: 30 }))
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    if (users.fields.getByName('telefone')) {
      users.fields.removeByName('telefone')
      app.save(users)
    }
  },
)
