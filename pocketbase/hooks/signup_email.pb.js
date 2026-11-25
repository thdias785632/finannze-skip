/**
 * Boas-vindas por e-mail do cadastro (Quitafy).
 *
 * NÃO existe mais NENHUM hook de evento de cadastro nesta instância: o envio
 * acontece INLINE dentro da rota POST /backend/v1/auth/registrar (ver
 * auth_registrar.pb.js), porque callbacks onRecordAfterCreateSuccess NÃO
 * executam nesta instância Skip Cloud (bug comprovado). Este arquivo é só um
 * marcador de build — não recriar hooks de evento de cadastro.
 */
