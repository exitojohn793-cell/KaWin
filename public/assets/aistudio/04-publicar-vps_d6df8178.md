# 04 · Publicar en la VPS del usuario (nginx + certbot + systemd)

Despliegas en **la VPS del usuario, en su propia dirección**: el nombre de host
que te dio en la fase 0 (`srvXXXXXXX.hstgr.cloud`). **No se pide dominio** y no se
toca ningún DNS: todo se hace por SSH, dentro de la VPS.

> **Pide permiso antes de tocar la VPS.** Y **respeta lo que ya hubiera**: haz una
> copia de seguridad antes de pisar nada y toca solo lo del proyecto. Puertos a
> internet: solo **22, 80 y 443**. Los servidores de proyecto escuchan en
> `127.0.0.1`, nunca en `0.0.0.0`.

Variables: `HOST` = nombre de host de la VPS (`srvXXXXXXX.hstgr.cloud`), `IP` = IP
de la VPS, `KEY` = `secret/<carpeta>_vps`, `APP` = nombre del proyecto.

## 0. La dirección: el nombre propio de la VPS

Se publica en `https://HOST/`. Ese nombre ya apunta a la VPS desde que se crea, así
que no hay nada que configurar fuera del servidor. Y como `hstgr.cloud` está en la
lista pública de sufijos, cada `srvXXXXXXX.hstgr.cloud` cuenta como dominio propio
para Let's Encrypt: el candado sale sin chocar con los límites de otros clientes.

Antes de instalar nada, **mira qué hay ya** (solo lectura):
```bash
ssh -i $KEY root@$IP "getent hosts HOST; ss -ltnp '( sport = :80 or sport = :443 )'; ls /etc/nginx/sites-enabled/ 2>/dev/null; grep -rls 'server_name.*HOST' /etc/nginx/ 2>/dev/null; grep -rls connection_upgrade /etc/nginx/ 2>/dev/null"
```
- `getent` tiene que devolver la IP de la VPS.
- Si los puertos 80/443 los ocupa algo que **no es nginx** (Apache, Caddy, Traefik,
  un panel en Docker...), **no lo toques**: explícaselo al usuario con palabras
  sencillas y para.
- Si ningún bloque de nginx usa `HOST` → el proyecto va en la **raíz**:
  `https://HOST/` (pasos 2A/2B tal cual).
- Si `HOST` ya sirve otro proyecto → **no lo pises**: el proyecto va en una
  **subcarpeta**, `https://HOST/APP/` (ver «2C. Subcarpeta»).

> Si el usuario pide «con mi dominio»: explícale en una frase que se publica en el
> nombre de su VPS, que ya es suyo y lleva candado. Hacer que un dominio apunte a
> la VPS se hace en su DNS, fuera de lo que esta skill toca.

## 1. Base de la máquina (una vez): nginx + certbot

Si no están ya, instala lo mínimo:
```bash
ssh -i $KEY root@$IP 'apt-get update && apt-get install -y nginx certbot python3-certbot-nginx'
```
Node, si hace falta, desde el tarball oficial de nodejs.org (no `apt-get install
nodejs`, que trae una versión vieja).

## 2A. Caso ESTÁTICO

```bash
# subir a un temporal y cambiar de golpe (la URL nunca queda a medias)
ssh -i $KEY root@$IP "rm -rf /tmp/$APP.subida"
scp -r -i $KEY ./sitio root@$IP:/tmp/$APP.subida
ssh -i $KEY root@$IP "rm -rf /var/www/$APP && mv /tmp/$APP.subida /var/www/$APP && chown -R root:root /var/www/$APP && chmod -R a+rX /var/www/$APP"
```
Bloque nginx (`/etc/nginx/sites-available/$APP`, symlink en `sites-enabled/`):
```nginx
server {
    listen 80;
    server_name HOST;
    root /var/www/APP;
    index index.html;
    location / { try_files $uri $uri/ =404; }
}
```
```bash
ssh -i $KEY root@$IP "ln -sf /etc/nginx/sites-available/$APP /etc/nginx/sites-enabled/$APP && nginx -t && systemctl reload nginx"
```

## 2B. Caso CON SERVIDOR / TIEMPO REAL (Node)

Sube el código a `/opt/$APP`, con un usuario de sistema sin shell, y un servicio
`systemd` que escuche en `127.0.0.1:<PUERTO>` (elige un puerto que no esté en uso:
`ss -ltn`):
```bash
scp -r -i $KEY ./app root@$IP:/tmp/$APP.subida
ssh -i $KEY root@$IP "id -u $APP >/dev/null 2>&1 || useradd --system --home-dir /opt/$APP --shell /usr/sbin/nologin $APP; systemctl stop $APP 2>/dev/null; rm -rf /opt/$APP && mv /tmp/$APP.subida /opt/$APP && chown -R $APP:$APP /opt/$APP"
```
`/etc/systemd/system/$APP.service`:
```ini
[Unit]
Description=APP
After=network.target

[Service]
User=APP
WorkingDirectory=/opt/APP
Environment=PORT=3010
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node /opt/APP/servidor.js
Restart=always

[Install]
WantedBy=multi-user.target
```
> **Con funciones de IA** ([06-ia-con-claude.md](06-ia-con-claude.md)): pasa antes
> `scripts/instalar-ia.sh APP` (deja al usuario `APP` con su carpeta en
> `/home/APP`, donde vive su sesión de Claude) y añade al servicio
> `Environment=HOME=/home/APP`. Si no, la app no encuentra la sesión. El `useradd`
> de arriba no lo pisa: solo crea el usuario si aún no existe.
Bloque nginx con **soporte de websockets** (clave para el tiempo real):
```nginx
# en el contexto http (una vez): mapear la cabecera Upgrade.
# Si el paso 0 ya encontró "connection_upgrade" en otro fichero, NO lo repitas.
map $http_upgrade $connection_upgrade { default upgrade; '' close; }

server {
    listen 80;
    server_name HOST;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;          # websocket
        proxy_set_header Connection $connection_upgrade; # websocket
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;   # conexiones en vivo largas
    }
}
```
```bash
ssh -i $KEY root@$IP "systemctl daemon-reload && systemctl enable --now $APP && nginx -t && systemctl reload nginx"
# comprobar que NO escucha abierto a internet (debe dar 000):
ssh -i $KEY root@$IP "curl -m 5 -o /dev/null -w '%{http_code}\n' http://$IP:3010/ || true"
```

## 2C. Subcarpeta (si `HOST` ya sirve otro proyecto)

No crees otro bloque `server` para `HOST`: **añade** un `location` al que ya hay,
con copia de seguridad antes y sin cambiar nada más del fichero.
```bash
ssh -i $KEY root@$IP "cp -a <fichero-del-bloque> /root/<fichero>.bak.\$(date +%Y%m%d%H%M%S)"
```
```nginx
# Node / tiempo real (la barra final de proxy_pass quita el /APP/ al reenviar)
location /APP/ {
    proxy_pass http://127.0.0.1:3010/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
}
# Estático
location /APP/ { alias /var/www/APP/; try_files $uri $uri/ =404; }
```
Funciona porque el cliente usa **rutas relativas**, también para el tiempo real
(ver [03-construir.md](03-construir.md)). `nginx -t` antes de recargar; si falla,
restaura la copia.

## 3. Candado (certificado) para `HOST`

```bash
ssh -i $KEY root@$IP "certbot --nginx -d HOST --non-interactive --agree-tos --register-unsafely-without-email --redirect"
```
> Aceptar las condiciones de Let's Encrypt es del usuario: pídelo antes. La
> renovación es automática (`certbot.timer`), así que no hace falta pedir correo.
> Si `HOST` ya tenía certificado (paso 0: otro proyecto en la raíz), no lo
> repitas: la subcarpeta ya va con candado.

## 4. Verificar (siempre, antes de cantar victoria)

```bash
curl -I https://HOST/            # (o https://HOST/APP/) -> 200 y candado
```
Para tiempo real, abre la web en dos dispositivos/pestañas y comprueba que el panel
y el móvil se sincronizan en vivo.

## 5. Actualizar más adelante

- Estático: repite el paso 2A (sube a temporal y cambia de golpe).
- Con servidor: repite el paso 2B y `systemctl restart $APP`. Si el proyecto guarda
  datos, sácalos antes del `rm -rf` y devuélvelos después.

## Problemas frecuentes

- **El tiempo real no conecta:** faltan las cabeceras `Upgrade`/`Connection` del
  bloque nginx, o el cliente usa `ws://` o `/ws` fijos en vez de deducirlos de la
  página.
- **502:** el servicio no está arriba → `systemctl status $APP` y
  `journalctl -u $APP`.
- **403 / no carga un archivo:** permisos → `chmod -R a+rX`.
- **El candado no sale:** certbot no pudo validar por el puerto 80 (lo ocupa otra
  cosa, o hay un cortafuegos cerrando el 80 en la VPS).
