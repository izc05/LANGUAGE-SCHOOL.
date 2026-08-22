# Language School V3 · 9.8 actualización controlada PILOT/TEST

Este runbook sirve exclusivamente para actualizar una instalación `pilot` existente de Language School V3. No fusiona PRs, no sustituye `main` y no contiene secretos.

`DEPLOYMENT_MODE` solo admite dos valores:

- `production`: conserva SMTP real obligatorio, Turnstile real con hostname exacto y todas las puertas fail-closed;
- `pilot`: admite SMTP deshabilitado y la pareja oficial de claves Turnstile de prueba, pero mantiene loopback, health, backups y bloqueo de `/_/` como condiciones obligatorias.

Si la variable falta, todos los scripts se comportan como `production`. Un valor distinto de `pilot` o `production` bloquea la operación.

La regla principal es sencilla: **no ejecutar ninguna operación destructiva hasta que el preflight de solo lectura no tenga fallos y exista un backup físico verificado**. Una instalación piloto antigua puede recibir avisos de deriva reparable; esos avisos no autorizan a modificar el host antes del backup.

## 0. Candidato autorizado

Antes de entrar al host, el candidato debe tener la matriz completa de CI verde en PR #11.

Guardar fuera del Mini PC el SHA completo autorizado:

```bash
APPROVED_SHA='<SHA_COMPLETO_7_7_VALIDADO>'
```

No obtener `APPROVED_SHA` automáticamente del checkout local: hacerlo anularía la protección frente a desplegar por error un commit distinto del revisado.

El PR debe seguir Draft, abierto y sin merge.

## 1. Actualizar únicamente el checkout de trabajo

Desde el checkout de Language School del Mini PC:

```bash
git fetch origin
git switch design/home-premium-v2
git pull --ff-only origin design/home-premium-v2
git status --short
git rev-parse HEAD
```

Puertas:

- rama exacta `design/home-premium-v2`;
- `git status --short` vacío;
- `git rev-parse HEAD` idéntico a `APPROVED_SHA`.

No usar `reset --hard`, force push ni merge para hacer coincidir el host.

## 2. Preflight 9.8A · solo lectura

Ejecutar desde la raíz del repositorio:

```bash
sudo \
  REPO_DIR="$PWD" \
  EXPECTED_SHA="$APPROVED_SHA" \
  EXPECTED_BRANCH='design/home-premium-v2' \
  EXPECTED_PUBLIC_ORIGIN='https://language-school.isivoltpro.com' \
  bash v3/infrastructure/raspberry-pi/preflight-update.sh
```

El preflight no modifica el host. Debe imprimir `Deployment mode: PILOT` o `Deployment mode: PRODUCTION` y comprobar como mínimo:

- SHA autorizado, rama y working tree limpio;
- frontend + migraciones + hooks presentes en el candidato;
- `/etc/language-school/production.env` legible;
- `PUBLIC_ORIGIN` HTTPS correcto;
- PocketBase y Nginx únicamente en loopback;
- en `production`, SMTP real habilitado para MFA y Turnstile real con hostname permitido;
- en `pilot`, `SMTP_ENABLED=false` como aviso explícito y la pareja oficial completa de claves Turnstile de prueba como configuración permitida;
- `TURNSTILE_EXPECTED_ACTION=contact` en ambos modos;
- disco de backup como mountpoint real;
- PocketBase y Nginx activos;
- runtime instalado con binario y migraciones;
- frontend instalado;
- health directo y por proxy;
- `/_/` bloqueado;
- superficie HTTPS pública accesible cuando `CHECK_PUBLIC=1`.

Una instalación piloto antigua que tenga binario + migraciones y esté sana, pero todavía no tenga `PB_RUNTIME_DIR/pb_hooks`, debe producir **WARN**, no `FAIL`. Ese aviso significa exclusivamente que el runtime está desfasado respecto al candidato. No copiar hooks a mano ni ejecutar el instalador todavía: primero hay que completar el backup físico de la fase 3. Tras el backup, la fase 4 debe reparar el runtime completo con `install-pocketbase.sh`, que instala juntos binario, migraciones y hooks desde el mismo candidato autorizado.

En `pilot` también son avisos admitidos la ausencia de Zoom, el health timer pendiente y la imposibilidad de probar MFA, invitaciones o recuperación por email cuando SMTP está deshabilitado. Ninguno de esos avisos relaja las puertas de datos, red o backup.

Si aparece cualquier `FAIL`, **parar aquí**. No ejecutar backup, migraciones ni deploy.

## 3. Backup físico previo obligatorio

```bash
sudo bash v3/infrastructure/backups/backup.sh
```

El script detiene PocketBase durante la copia, exige un mountpoint real, crea el `.tar.gz`, genera SHA-256, verifica el checksum y vuelve a arrancar el servicio.

Anotar las dos rutas que imprime:

```text
Backup created: ...
Checksum verified: ...
```

Volver a validar el checksum de la copia elegida antes de continuar:

```bash
cd /mnt/language-school-backup/language-school
sha256sum -c language-school-<TIMESTAMP>.tar.gz.sha256
```

Resultado obligatorio: `OK`.

## 4. Actualizar runtime PocketBase de la misma revisión

```bash
sudo bash v3/infrastructure/raspberry-pi/install-pocketbase.sh
```

Esto mantiene unidos en la misma revisión:

- binario PocketBase fijado;
- `pb_migrations`;
- `pb_hooks`.

No copiar migraciones u hooks individualmente a mano.

Si el preflight previo avisó de que el runtime antiguo no tenía `pb_hooks`, confirmar después del instalador y antes de migrar:

```bash
sudo test -x /opt/language-school/pocketbase/pocketbase
sudo test -d /opt/language-school/pocketbase/pb_migrations
sudo test -d /opt/language-school/pocketbase/pb_hooks
```

Las tres comprobaciones deben terminar con código 0. Si alguna falla, parar antes de migrar.

## 5. Aplicar migraciones

```bash
sudo bash v3/infrastructure/raspberry-pi/migrate.sh
```

El script detiene PocketBase si estaba activo, ejecuta las migraciones con el usuario `languageschool` y vuelve a arrancar el servicio.

Si la migración falla o el estado de los datos es dudoso, no continuar con el frontend. Usar el backup físico de la fase 3 para recuperar la base mediante `restore.sh`.

## 6. Frontend conectado · promoción atómica

```bash
bash v3/infrastructure/raspberry-pi/deploy-frontend.sh
```

El deploy:

1. compila completamente antes de tocar el directorio vivo;
2. exige `PUBLIC_ORIGIN`, `PROXY_URL` loopback y Turnstile acorde al modo: real en `production`, real o pareja oficial de prueba en `pilot`;
3. prepara el build en `frontend.staging`;
4. conserva el frontend vivo anterior como `frontend.previous`;
5. promociona mediante rename dentro del mismo filesystem;
6. compara el SHA-256 del `index.html` preparado con el que sirve Nginx;
7. si la verificación falla, restaura automáticamente el frontend anterior.

No borrar `/opt/language-school/frontend.previous` hasta cerrar los smokes y el periodo piloto acordado.

## 7. Health local obligatorio

```bash
bash v3/infrastructure/raspberry-pi/health-check.sh
```

Debe terminar con:

```text
Language School health check: SUCCESS
```

Comprobar además:

```bash
systemctl is-active language-school-pocketbase
systemctl is-active nginx
curl -fsS http://127.0.0.1:8091/api/health
curl -fsS http://127.0.0.1:8083/api/health
```

## 8. Superficie pública

Desde un equipo que resuelva el dominio del piloto:

```bash
curl -fsS https://language-school.isivoltpro.com/
curl -fsS https://language-school.isivoltpro.com/api/health
curl -sS -o /dev/null -w '%{http_code}\n' https://language-school.isivoltpro.com/_/
```

`/_/` debe devolver `404`.

No abrir 8083/8091 en el router para realizar estas pruebas.

## 9. Smoke funcional posterior a actualización

No dar el piloto por actualizado solo porque `/api/health` responda.

Validar en navegador real solo las capacidades disponibles en el perfil:

- Web pública y responsive;
- Contacto + Turnstile, indicando expresamente si se usa la pareja oficial de prueba;
- ADMIN existente: contraseña → MFA email → `/admin`, solo cuando SMTP esté configurado;
- segundo ADMIN temporal: invitación → email → contraseña propia → MFA → `/admin`, solo cuando SMTP esté configurado;
- Profesor;
- Alumno;
- Test de nivel público y Campus;
- clase/agenda;
- archivos/material/tareas;
- Zoom cuando existan credenciales reales;
- recuperación de contraseña, solo cuando SMTP esté configurado.

La invitación del segundo ADMIN nunca debe mostrar el enlace secreto en el panel del administrador que invita.

## 10. Rollback frontend

Si PocketBase y los datos están sanos pero el nuevo frontend presenta una incidencia funcional posterior al deploy:

```bash
sudo bash v3/infrastructure/raspberry-pi/rollback-frontend.sh
```

El rollback:

- exige `frontend.previous`;
- conserva el frontend rechazado como `frontend.failed-<TIMESTAMP>`;
- promociona el anterior;
- verifica por SHA-256 lo servido por Nginx;
- si esa verificación falla, revierte el propio rollback.

Después ejecutar de nuevo `health-check.sh` y los smokes afectados.

## 11. Rollback PocketBase / datos

Si la incidencia afecta migraciones o datos, usar exclusivamente una copia verificada:

```bash
sudo bash v3/infrastructure/backups/restore.sh \
  /mnt/language-school-backup/language-school/language-school-<TIMESTAMP>.tar.gz
```

`restore.sh` exige el `.sha256`, valida rutas del tar, conserva `pb_data.before-restore-*` y restaura automáticamente la base anterior si PocketBase no vuelve sano.

Cuando la incidencia combine frontend y datos, recuperar ambos lados antes de reabrir el piloto y repetir health + smoke completo.

## 12. Cierre del piloto actualizado

No marcar 9.8 como cerrada hasta verificar en el host real:

- candidato exacto autorizado;
- backup físico + checksum;
- `DEPLOYMENT_MODE=pilot` confirmado y datos exclusivamente de prueba;
- dependencias no disponibles (SMTP/MFA, Zoom o Listening) declaradas expresamente;
- Turnstile real o pareja oficial de prueba acorde al modo;
- migraciones correctas;
- frontend atómico correcto;
- health local y público;
- smoke Web/Admin/Profesor/Alumno/Test/Zoom según disponibilidad real;
- backup programado intacto;
- otros servicios del Mini PC, incluido Atelier Lumière, sin regresiones.

PR #11 seguirá Draft y sin merge durante el piloto. El merge solo puede ocurrir tras aprobación explícita posterior.
