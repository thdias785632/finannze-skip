// Meses de referência do INCC por imóvel (antes era a constante fixa
// TRAVA_INCC_MESES = 2 no front): campo `incc_meses_referencia` em imoveis
// (padrão 2 em todos os imóveis existentes), editável pelo usuário.
migrate(
  (app) => {
    const imoveis = app.findCollectionByNameOrId('imoveis')
    if (!imoveis.fields.getByName('incc_meses_referencia')) {
      imoveis.fields.add(
        new NumberField({
          name: 'incc_meses_referencia',
          required: false,
          onlyInt: true,
          min: 0,
          max: 12,
        }),
      )
    }
    app.save(imoveis)

    // Preenche o padrão (2) nos imóveis que ainda não têm o campo.
    const registros = app.findRecordsByFilter(
      'imoveis',
      "incc_meses_referencia = '' || incc_meses_referencia = null",
      '',
      0,
      0,
    )
    for (const r of registros) {
      r.set('incc_meses_referencia', 2)
      app.save(r)
    }
  },
  (app) => {
    const imoveis = app.findCollectionByNameOrId('imoveis')
    const f = imoveis.fields.getByName('incc_meses_referencia')
    if (f) imoveis.fields.remove(f)
    app.save(imoveis)
  },
)
