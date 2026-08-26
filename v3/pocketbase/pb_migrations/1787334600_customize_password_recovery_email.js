/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('users')

  users.passwordResetToken.duration = 1800
  users.resetPasswordTemplate.subject = 'Recupera tu contraseña de {APP_NAME}'
  users.resetPasswordTemplate.body = `
    <p>Hola,</p>
    <p>Hemos recibido una solicitud para crear una nueva contraseña de acceso a {APP_NAME}.</p>
    <p>
      <a class="btn" href="{APP_URL}/recuperar-cuenta?token={TOKEN}" target="_blank" rel="noopener">Crear nueva contraseña</a>
    </p>
    <p>Este enlace es temporal. Si no has solicitado el cambio, puedes ignorar este correo.</p>
    <p>La academia nunca te pedirá que envíes tu contraseña por email, WhatsApp o teléfono.</p>
    <p>Gracias,<br/>{APP_NAME}</p>
  `.trim()

  app.save(users)
}, (app) => {
  const users = app.findCollectionByNameOrId('users')

  users.passwordResetToken.duration = 1800
  users.resetPasswordTemplate.subject = 'Reset your {APP_NAME} password'
  users.resetPasswordTemplate.body = `
    <p>Hello,</p>
    <p>Click on the button below to reset your password.</p>
    <p>
      <a class="btn" href="{APP_URL}/_/#/auth/confirm-password-reset/{TOKEN}" target="_blank" rel="noopener">Reset password</a>
    </p>
    <p><i>If you didn't ask to reset your password, you can ignore this email.</i></p>
    <p>Thanks,<br/>{APP_NAME} team</p>
  `.trim()

  app.save(users)
})
