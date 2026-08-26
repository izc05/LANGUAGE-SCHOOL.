# Cloudflare Tunnel · Language School V3

## Arquitectura

Cloudflare Tunnel nunca apunta a PocketBase directamente.

```text
Internet
  -> Cloudflare Tunnel
  -> http://127.0.0.1:8083 (Nginx)
       -> /        React estático
       -> /api/*   PocketBase 127.0.0.1:8091
```

PocketBase `/_/` no se publica mediante Nginx.

Los puertos anteriores corresponden a la plantilla versionada actual. Si se cambian en `/etc/language-school/production.env`, el Tunnel debe apuntar siempre al `PROXY_URL` loopback de Nginx, nunca a `PB_URL`.

## Opción recomendada: túnel gestionado remotamente

Crea el túnel desde Cloudflare Zero Trust, configura un hostname público y usa como servicio de origen:

```text
http://127.0.0.1:8083
```

Instala `cloudflared` como servicio usando el token que entrega Cloudflare. El token es secreto y nunca se guarda en GitHub.

## Alternativa: túnel gestionado localmente

`config.yml.example` sirve únicamente como plantilla. Copia el archivo fuera del repositorio, sustituye el UUID/hostname y coloca el JSON de credenciales en `/etc/cloudflared/` con permisos restrictivos.

La última regla de `ingress` debe seguir siendo el catch-all `http_status:404`.

Antes de activar un túnel local, valida su configuración con `cloudflared tunnel ingress validate` y comprueba que el servicio de origen responde en `127.0.0.1:8083`.

## Seguridad de bots y abuso

Después de que el hostname real funcione por HTTPS, aplicar y verificar la política descrita en:

```text
v3/infrastructure/cloudflare/SECURITY-RULES.md
```

La política separa:

- SEO/buscadores legítimos;
- crawlers de IA para Search frente a Training;
- rate limiting de login;
- rate limiting de contacto;
- creación/mutaciones del test de nivel;
- criterios para activar Turnstile si aparece spam real.

No usar `robots.txt` como barrera de seguridad. El repositorio publica sus preferencias en `/robots.txt`, mientras el bloqueo técnico de crawlers/abuso se hace en Cloudflare y en la segunda barrera de Nginx.

## Comprobación

Una vez activo el túnel y antes del piloto:

1. `/` debe devolver el frontend.
2. `/robots.txt` debe devolver la política versionada.
3. `/api/health` debe devolver la salud de PocketBase.
4. `/_/` no debe mostrar el panel administrativo de PocketBase.
5. No debe haber ningún reenvío de puertos 8091/8083 en el router.
6. `/acceso`, `/admin`, `/alumno`, `/profesor` y `/api/*` deben quedar fuera de indexación.
7. Un login/contacto normal debe funcionar.
8. Las ráfagas por encima de los umbrales configurados deben ser mitigadas.
9. El test de nivel completo, Listening y realtime deben funcionar sin falsos positivos.
10. Revisar Security Events y AI Crawl Control después de la prueba.

## Evidencia externa

No marcar Cloudflare como validado solo porque estos archivos existan. La FASE 9 requiere evidencia del dominio real: Tunnel activo, HTTPS, reglas aplicadas y smoke tests desde Internet.
