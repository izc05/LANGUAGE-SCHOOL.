# Cloudflare Tunnel · Language School V3

## Arquitectura

Cloudflare Tunnel nunca apunta a PocketBase directamente.

```text
Internet
  -> Cloudflare Tunnel
  -> http://127.0.0.1:8080 (Nginx)
       -> /        React estático
       -> /api/*   PocketBase 127.0.0.1:8090
```

PocketBase `/_/` no se publica mediante Nginx.

## Opción recomendada: túnel gestionado remotamente

Cloudflare recomienda actualmente los túneles gestionados remotamente para la mayoría de despliegues. Crea el túnel desde Cloudflare Zero Trust, configura un hostname público y usa como servicio de origen:

```text
http://127.0.0.1:8080
```

Instala `cloudflared` como servicio usando el token que entrega Cloudflare. El token es secreto y nunca se guarda en GitHub.

## Alternativa: túnel gestionado localmente

`config.yml.example` sirve únicamente como plantilla. Copia el archivo fuera del repositorio, sustituye el UUID/hostname y coloca el JSON de credenciales en `/etc/cloudflared/` con permisos restrictivos.

La última regla de `ingress` debe seguir siendo el catch-all `http_status:404`.

Antes de activar un túnel local, valida su configuración con `cloudflared tunnel ingress validate` y comprueba que el servicio de origen responde en `127.0.0.1:8080`.

## Comprobación

Una vez activo el túnel:

1. `/` debe devolver el frontend.
2. `/api/health` debe devolver la salud de PocketBase.
3. `/_/` no debe mostrar el panel administrativo de PocketBase.
4. No debe haber ningún reenvío de puertos 8090/8080 en el router.
