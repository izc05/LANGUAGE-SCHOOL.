# Language School V3 · Runbook de producción Cloudflare

Este documento define el orden seguro para publicar la capa de seguridad de FASE 7K sin improvisar cambios en producción.

No contiene claves reales, tokens de Tunnel ni contraseñas.

## Estado requerido antes de empezar

No iniciar el rollout si no se cumple todo lo siguiente:

- PR de seguridad validado por CI;
- `main` sin modificar por esta fase;
- hostname definitivo conocido y administrado por Cloudflare;
- Cloudflare Tunnel disponible o preparado;
- acceso administrativo al servidor;
- disco de backup real montado en `BACKUP_MOUNT`;
- copia de seguridad de PocketBase verificable;
- posibilidad de volver al commit/candidato anterior del servidor.

## 1. Crear Turnstile en Cloudflare

Crear un widget para el hostname público definitivo.

Guardar de forma segura:

```text
TURNSTILE_SITE_KEY=<site-key pública>
TURNSTILE_SECRET_KEY=<secret privada>
```

El widget del frontend usa la acción:

```text
contact
```

La configuración de producción debe exigir la misma acción y el hostname real.

No guardar la secret en GitHub, `.env.example`, JavaScript, HTML, capturas o documentación compartida.

## 2. Preparar `/etc/language-school/production.env`

Si el archivo no existe todavía:

```bash
sudo bash v3/infrastructure/raspberry-pi/prepare-production-env.sh
```

Editar después el archivo root-owned:

```bash
sudoedit /etc/language-school/production.env
```

Como mínimo deben quedar correctos:

```text
PUBLIC_ORIGIN=https://HOSTNAME_REAL
TURNSTILE_SITE_KEY=SITE_KEY_REAL
TURNSTILE_SECRET_KEY=SECRET_REAL
TURNSTILE_EXPECTED_ACTION=contact
TURNSTILE_ALLOWED_HOSTNAMES=HOSTNAME_REAL
PB_URL=http://127.0.0.1:8091
PROXY_URL=http://127.0.0.1:8083
BACKUP_MOUNT=/PUNTO/DE/MONTAJE/REAL
```

Comprobar permisos:

```bash
sudo chown root:root /etc/language-school/production.env
sudo chmod 0640 /etc/language-school/production.env
```

Nunca imprimir el archivo completo en terminal grabada, logs de CI o chat.

## 3. Backup obligatorio antes de migrar

Confirmar primero que `BACKUP_MOUNT` es un montaje real:

```bash
sudo mountpoint "$(sudo bash -c 'source /etc/language-school/production.env; printf %s "$BACKUP_MOUNT"')"
```

Crear backup consistente:

```bash
sudo bash v3/infrastructure/backups/backup.sh
```

El script detiene PocketBase durante la copia, crea el `.tar.gz`, calcula SHA-256 y vuelve a arrancar el servicio si estaba activo.

No continuar si el backup falla.

## 4. Instalar/actualizar PocketBase + hooks

```bash
sudo bash v3/infrastructure/raspberry-pi/install-pocketbase.sh
```

El instalador copia:

```text
pb_migrations
pb_hooks
start-pocketbase.sh
systemd service
```

Todavía no depende de que el hostname público esté accesible para copiar los ficheros.

## 5. Aplicar migraciones

```bash
sudo bash v3/infrastructure/raspberry-pi/migrate.sh
```

La migración de FASE 7K bloquea el alta pública directa de `contact_requests`.

No continuar si la migración devuelve error.

## 6. Instalar Nginx endurecido

```bash
sudo bash v3/infrastructure/reverse-proxy/install-nginx.sh
```

El instalador valida `nginx -t` antes de mantener la nueva configuración y restaura la anterior si la nueva no es válida.

Después deben seguir existiendo únicamente estos accesos locales:

```text
PocketBase  -> 127.0.0.1:8091
Nginx       -> 127.0.0.1:8083
```

No abrir 8091 ni 8083 en el router.

## 7. Arrancar PocketBase

```bash
sudo systemctl restart language-school-pocketbase.service
sudo systemctl status language-school-pocketbase.service --no-pager
```

El wrapper de producción falla cerrado si:

- `PB_URL` no es loopback;
- falta la secret real de Turnstile;
- `TURNSTILE_EXPECTED_ACTION` no es `contact`;
- `PUBLIC_ORIGIN` no es HTTPS limpio;
- `TURNSTILE_ALLOWED_HOSTNAMES` no contiene el hostname de `PUBLIC_ORIGIN`.

Si el servicio no arranca, corregir la configuración. No debilitar estas validaciones para forzar el arranque.

## 8. Desplegar frontend conectado

```bash
bash v3/infrastructure/raspberry-pi/deploy-frontend.sh
```

El despliegue exige:

- HTTPS real en `PUBLIC_ORIGIN`;
- site key Turnstile no-placeholder;
- Node compatible con Vite 8;
- build TypeScript/Vite correcto antes de sustituir `/opt/language-school/frontend`.

## 9. Health check local antes de Cloudflare

```bash
bash v3/infrastructure/raspberry-pi/health-check.sh
```

Debe terminar en:

```text
Language School health check: SUCCESS
```

Verifica servicio PocketBase, health directo, health por Nginx, frontend y bloqueo de `/_/`.

No activar tráfico público si este paso falla.

## 10. Conectar Cloudflare Tunnel

El hostname público debe terminar en:

```text
http://127.0.0.1:8083
```

Nunca configurar el Tunnel directamente contra `127.0.0.1:8091`.

Para túnel gestionado remotamente, instalar `cloudflared` como servicio con el token entregado por Cloudflare, manteniendo dicho token fuera del repositorio.

Para configuración local, validar antes:

```bash
cloudflared tunnel ingress validate
```

La última regla de ingress debe seguir siendo:

```text
http_status:404
```

## 11. Activar controles en Cloudflare

Aplicar únicamente las opciones compatibles con el plan real. Consultar `README.md` de este mismo directorio para las expresiones Free / Pro / Business.

Orden recomendado:

1. Turnstile real ya operativo en Contacto;
2. Rate Limiting de login/contacto compatible con el plan;
3. AI Crawl Control;
4. observación de Security Events;
5. endurecimiento posterior solo después de descartar falsos positivos.

Mantener inicialmente nuestro `robots.txt` como fuente de verdad. No activar un robots.txt gestionado adicional sin revisar el resultado final servido al público.

No activar Bot Fight Mode a ciegas sobre este hostname compartido con `/api/*`.

## 12. Verificación exterior obligatoria

Desde un equipo distinto al servidor:

```bash
bash v3/infrastructure/cloudflare/verify-production.sh https://HOSTNAME_REAL
```

Debe terminar en:

```text
VERIFICACIÓN EXTERIOR SUPERADA.
```

Comprueba, entre otras cosas:

- tráfico realmente pasando por Cloudflare (`CF-Ray`);
- `Content-Signal` del origen;
- `robots.txt`;
- `X-Robots-Tag` privado;
- `/api/health`;
- `/_/` oculto;
- rechazo del endpoint de contacto sin Turnstile;
- rechazo del bypass directo de `contact_requests`.

## 13. Prueba funcional manual final

Realizar una única prueba humana completa:

```text
Contacto público
  -> Turnstile resuelto
  -> solicitud enviada
  -> Admin recibe la solicitud
  -> cambiar a CONTACTED
  -> cambiar a CLOSED
```

Después probar un login válido de cada rol necesario sin provocar artificialmente múltiples fallos de contraseña.

## 14. Revisión Cloudflare después del rollout

Revisar:

- Security Events;
- Turnstile Analytics;
- hostnames observados por Turnstile;
- AI Crawl Control > Crawlers;
- AI Crawl Control > Robots.txt;
- posibles falsos positivos de Rate Limiting;
- que Google/Bing y los agentes de búsqueda/asistencia autorizados sigan llegando a contenido público.

No reducir límites o ampliar bloqueos únicamente porque exista tráfico automatizado: diferenciar búsqueda legítima, asistencia y entrenamiento/scraping.

# Rollback

## A. Fallo antes de migraciones

No hay cambio de datos. Volver al candidato anterior del repositorio/servidor y reinstalar Nginx/frontend si fuera necesario.

## B. Fallo de Nginx

`install-nginx.sh` ya restaura el fichero anterior si `nginx -t` falla durante la instalación.

Si el problema aparece después:

1. desactivar temporalmente el hostname/Tunnel si está sirviendo respuestas incorrectas;
2. restaurar la configuración Nginx anterior conocida;
3. ejecutar `nginx -t`;
4. recargar Nginx;
5. repetir `health-check.sh`.

## C. Fallo de frontend

Volver al commit candidato anterior y ejecutar nuevamente:

```bash
bash v3/infrastructure/raspberry-pi/deploy-frontend.sh
```

No hace falta restaurar PocketBase si no hubo cambio de datos incompatible.

## D. Fallo después de migraciones o corrupción de datos

Usar únicamente un backup creado y verificado antes del rollout.

El repositorio incluye:

```text
v3/infrastructure/backups/restore.sh
```

Antes de restaurar:

1. retirar tráfico público o poner el servicio fuera de alcance;
2. identificar exactamente el archivo `.tar.gz` correcto;
3. verificar su `.sha256`;
4. seguir las protecciones de `restore.sh`;
5. repetir migraciones solo si el candidato restaurado las requiere;
6. ejecutar `health-check.sh` antes de reabrir tráfico.

## E. Falso positivo de Cloudflare

Si el origen y `verify-production.sh` están correctos pero un usuario legítimo queda bloqueado:

1. revisar el evento exacto en Security Events;
2. identificar qué regla actuó;
3. relajar/desactivar únicamente esa regla Cloudflare;
4. mantener Turnstile y el rate limiting de Nginx activos;
5. repetir el flujo legítimo;
6. no desactivar todas las capas a la vez.

# Criterio de cierre de FASE 7K en producción

FASE 7K solo puede considerarse completamente aplicada en producción cuando simultáneamente:

- los cuatro workflows del candidato están verdes;
- existe backup previo verificable;
- PocketBase y Nginx pasan health check local;
- el Tunnel apunta a Nginx, nunca a PocketBase;
- Turnstile real valida Contacto end-to-end;
- Rate Limiting Cloudflare está aplicado según el plan real;
- AI Crawl Control refleja la política búsqueda/asistencia sí, entrenamiento no;
- `verify-production.sh` termina correctamente desde fuera del servidor;
- Security Events no muestra falsos positivos graves;
- el PR continúa sin fusionarse hasta aprobación explícita.
