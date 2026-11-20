migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    if (!users.fields.getByName('plan')) {
      users.fields.add(
        new SelectField({
          name: 'plan',
          required: false,
          values: ['free', 'vip', 'premium'],
          maxSelect: 1,
        }),
      )
    }

    // Update rule allows self-update of name, avatar, etc., but locks 'plan' from self-elevation
    users.updateRule =
      "@request.auth.id != '' && id = @request.auth.id && @request.body.plan:changed = false"
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const field = users.fields.getByName('plan')
    if (field) {
      users.fields.removeByName('plan')
      app.save(users)
    }
  },
)
