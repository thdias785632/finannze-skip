/**
 * Rota pública GET /backend/v1/config/contato
 *
 * Expõe para o FRONT o link de contato por WhatsApp configurado no secret
 * WHATSAPP_CONTATO_URL (o painel de secrets não chega ao front; esta rota é
 * a ponte — pública, sem dados de usuário, só o link).
 *
 * Respostas:
 *   200 { contato: "https://wa.me/5511999998888" }  — secret configurado
 *   200 { contato: null }                            — secret ausente/vazio
 *                                                  (o front usa o fallback padrão)
 *
 * O secret é lido com $os.getenv; set_env só injeta em runtime após novo
 * deploy_backend — se mudar o valor, redeploy do hook.
 */

routerAdd('GET', '/backend/v1/config/contato', (c) => {
  const bruto = String($os.getenv('WHATSAPP_CONTATO_URL') || '').trim()
  const contato = bruto !== '' ? bruto : null
  return c.json(200, { contato: contato })
})
