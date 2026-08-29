# Cloudflare Tunnel · Language School V3

## Dominio de producción

El dominio oficial preparado para producción es:

```text
https://languageschoolrocio.com
```

También se reserva `www.languageschoolrocio.com` para dirigirlo al mismo servicio. La aplicación y la API se publican bajo el mismo origen; no se expone PocketBase directamente.

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

## Opción recomendada: túnel gestionado remotamente

Cloudflare recomienda actualmente los túneles gestionados remotamente para la mayoría de despliegues. Crea o reutiliza el túnel desde Cloudflare Zero Trust y configura estos hostnames públicos contra el mismo origen:

```text
languageschoolrocio.com      -> http://127.0.0.1:8083
www.languageschoolrocio.com  -> http://127.0.0.1:8083
```

Instala `cloudflared` como servicio usando el token que entrega Cloudflare. El token es secreto y nunca se guarda en GitHub.

## Alternativa: túnel gestionado localmente

`config.yml.example` sirve únicamente como plantilla. Copia el archivo fuera del repositorio, sustituye el UUID y coloca el JSON de credenciales en `/etc/cloudflared/` con permisos restrictivos.

La última regla de `ingress` debe seguir siendo el catch-all `http_status:404`.

Antes de activar un túnel local, valida su configuración con `cloudflared tunnel ingress validate` y comprueba que el servicio de origen responde en `127.0.0.1:8083`.

## Comprobación

Una vez activo el túnel:

1. `https://languageschoolrocio.com/` debe devolver el frontend.
2. `https://languageschoolrocio.com/api/health` debe devolver la salud de PocketBase.
3. `https://languageschoolrocio.com/_/` no debe mostrar el panel administrativo de PocketBase.
4. `www.languageschoolrocio.com` debe resolver al mismo despliegue o redirigir al dominio raíz.
5. No debe haber ningún reenvío de puertos 8091/8083 en el router.
