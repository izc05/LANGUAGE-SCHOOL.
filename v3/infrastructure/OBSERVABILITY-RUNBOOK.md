# Language School V3 · Observabilidad y recuperación

Este runbook cubre la supervisión local de la plataforma sin enviar datos académicos, credenciales ni contenido de formularios a servicios externos.

## Qué se supervisa

`language-school-health.timer` ejecuta cada cinco minutos `health-check.sh` y comprueba únicamente:

1. servicio systemd de PocketBase;
2. `/api/health` directo en loopback;
3. `/api/health` a través de Nginx;
4. carga del frontend a través de Nginx;
5. bloqueo del panel `/_/` de PocketBase en el proxy público.

La salida esperada contiene solo etiquetas `OK`/`FAIL`. Nunca debe imprimir el entorno de producción, tokens, contraseñas, cuerpos de contacto ni datos de alumnos.

## Instalación

Después de instalar PocketBase, Nginx y el frontend:

```bash
sudo bash v3/infrastructure/raspberry-pi/install-health-monitor.sh
```

Comprobar el timer:

```bash
systemctl status language-school-health.timer
systemctl list-timers language-school-health.timer
```

Ejecutar una comprobación inmediata:

```bash
sudo systemctl start language-school-health.service
systemctl status language-school-health.service
```

## Consultar historial

```bash
journalctl -u language-school-health.service --since "30 minutes ago" --no-pager
journalctl -u language-school-pocketbase.service --since "30 minutes ago" --no-pager
systemctl status nginx
```

Cuando Cloudflare Tunnel esté instalado como servicio:

```bash
systemctl status cloudflared
journalctl -u cloudflared --since "30 minutes ago" --no-pager
```

## Orden de diagnóstico

### 1. Falla PocketBase directo

```bash
systemctl status language-school-pocketbase.service
journalctl -u language-school-pocketbase.service -n 100 --no-pager
curl -fsS http://127.0.0.1:8091/api/health
```

No reiniciar repetidamente sin leer antes el motivo. Si existe un error tras una migración o despliegue, seguir el procedimiento de rollback/restore correspondiente.

### 2. PocketBase directo funciona pero falla `/api/health` por proxy

```bash
sudo nginx -t
systemctl status nginx
curl -i http://127.0.0.1:8083/api/health
```

Revisar la revisión desplegada de `language-school.nginx.conf` y confirmar que `PB_URL` coincide con el puerto loopback real.

### 3. API funciona pero falla el frontend

```bash
ls -l /opt/language-school/frontend/index.html
curl -I http://127.0.0.1:8083/
```

Si la última publicación del frontend es la causa, restaurar el artefacto anterior antes de modificar PocketBase.

### 4. Todo funciona en loopback pero el dominio no responde

No tocar PocketBase ni la base de datos. Revisar Cloudflare Tunnel, DNS y el servicio `cloudflared`.

## Panel Admin → Sistema

El panel de Administración es una vista de diagnóstico funcional, no un sustituto de journald. Debe mostrar únicamente:

- salud y latencia del backend;
- modo y origen público de API;
- preparación de Zoom mediante indicadores booleanos server-side, nunca secretos;
- existencia de una versión publicada del test de nivel.

La comprobación OAuth real de Zoom se realiza manualmente desde Admin → Zoom y no se ejecuta automáticamente en la pantalla Sistema.

## Privacidad de logs

No añadir a los scripts de observabilidad:

- `set -x`;
- volcado de `/etc/language-school/production.env`;
- cabeceras Authorization/Cookie;
- payloads de formularios;
- nombres, emails o respuestas académicas;
- secretos Zoom, Turnstile o Cloudflare.

Para compartir un diagnóstico, usar estados de servicio, códigos HTTP, timestamps y mensajes técnicos sin PII.

## Criterio de 9.4

La observabilidad queda preparada en código cuando:

- el monitor periódico está versionado e instalable;
- Infrastructure CI valida servicio, timer e instalador;
- Admin → Sistema muestra Backend + Zoom + Test de nivel sin secretos;
- E2E confirma que un STUDENT no accede al diagnóstico;
- la comprobación real del timer se conserva como tarea del host de producción.
