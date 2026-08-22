# Language School · captura local de correo PILOT

Esta infraestructura permite completar MFA, invitaciones y recuperación de contraseña en un entorno `pilot` sin entregar correo a Internet. No desactiva MFA, no introduce códigos fijos y no cambia el contrato de `production`.

## Aislamiento

- El servidor SMTP escucha exclusivamente en `127.0.0.1`.
- No existe panel web ni puerto HTTP de bandeja.
- La consulta se realiza mediante un socket Unix con modo `0600`.
- Los mensajes se conservan solo en memoria, con un máximo de 100, y desaparecen al reiniciar el servicio.
- El cuerpo y el OTP no se escriben en logs.
- El proceso se niega a arrancar salvo que `DEPLOYMENT_MODE=pilot` y `PILOT_MAIL_CAPTURE=true`.
- Preflight, wrapper de PocketBase y hook de configuración rechazan la captura local en `production`.

## Configuración del host PILOT

Editar `/etc/language-school/production.env` como root, sin guardar valores reales en Git:

```dotenv
DEPLOYMENT_MODE=pilot
PILOT_MAIL_CAPTURE=true
SMTP_ENABLED=true
SMTP_HOST=127.0.0.1
SMTP_PORT=2526
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_AUTH_METHOD=
SMTP_TLS=false
SMTP_LOCAL_NAME=language-school-pilot.local
SMTP_SENDER_ADDRESS=pilot-mail@language-school.isivoltpro.com
SMTP_SENDER_NAME="Language School PILOT"
```

Mantener el archivo como `root:root 0640`. El remitente identifica correo de prueba; no es una credencial ni entrega mensajes fuera del host.

## Instalación posterior a un backup verificado

Desde el candidato autorizado:

```bash
sudo bash v3/infrastructure/pilot-mail/install-pilot-mail.sh
systemctl is-active language-school-pilot-mail.service
sudo language-school-pilot-mail health
```

Después reiniciar PocketBase mediante el procedimiento controlado autorizado para que `production_identity_settings.pb.js` aplique SMTP al runtime. No editar la configuración interna de PocketBase a mano.

## Recuperar el último OTP

Solicitar primero el código real desde la pantalla de acceso. A continuación, en el Mini PC:

```bash
sudo language-school-pilot-mail latest admin@example.invalid
```

La utilidad muestra metadatos mínimos y el OTP real capturado. No usar códigos inventados ni compartir la salida. Para vaciar la memoria tras las pruebas:

```bash
sudo language-school-pilot-mail clear
```

## Regreso a producción

Antes de `DEPLOYMENT_MODE=production`, deshabilitar y retirar la captura PILOT, configurar un proveedor SMTP real con TLS y credenciales reales, ejecutar preflight y verificar una entrega real. `production` falla si detecta `PILOT_MAIL_CAPTURE=true` o un hostname SMTP local/loopback.
