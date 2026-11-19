# 03 · Construir el software (stack y convenciones)

Con el PLAN aprobado, construyes el software **completo** y **con marca propia**.
Orden: **el recorrido principal de punta a punta primero**, luego el resto, luego
las mejoras del plan (lo que el original no tiene).

## Elegir el stack (del plan)

Tres casos, de menos a más:

1. **Estático** (HTML + CSS + JS, sin build). Para software cuyo valor está en el
   cliente (herramientas, calculadoras, visores). Convenciones del canal:
   - `<script defer>` clásico + IIFE; nada de `type="module"` con imports
     relativos servidos desde subcarpeta.
   - Rutas **relativas** siempre (`href="estilos.css"`, no `/estilos.css`).
   - Contenido en el HTML; el JS solo enriquece (debe leerse con JS apagado).
   - `.htaccess` + `?v=AAAAMMDD` para romper caché en cada publicación.
   - Verifica en local con `python -m http.server`.

2. **Con servidor propio** (Node o Python). Cuando hay cuentas, datos que persisten,
   lógica que no puede vivir en el navegador, o una clave que no puede bajar al
   cliente. El servidor escucha en `127.0.0.1:<puerto>` y se publica detrás de
   nginx (ver [04-publicar-vps.md](04-publicar-vps.md)). Guarda los datos **fuera**
   de la carpeta web para que un redepliegue no los borre.

3. **Tiempo real** (Node + websockets). Cuando varios dispositivos reaccionan a la
   vez: un panel que cambia en pantalla y móviles que responden al instante, un
   chat, un editor colaborativo, un juego o quiz en vivo (jugadores que entran con
   un **PIN** o escaneando un **QR** y compiten en directo).
   - Node con `ws` (o `socket.io`). Estado de la sala en memoria o en SQLite.
   - El cliente abre la conexión en tiempo real con una ruta **relativa a la
     página**, nunca `/ws` fijo:
     `new WebSocket(new URL('ws', location.href).href.replace(/^http/, 'ws'))`.
     Así funciona igual en local, en la raíz y en una subcarpeta
     (`https://HOST/APP/`). Por lo mismo, sirve las páginas desde la carpeta raíz
     de la app (`juego.html`, `?pin=123456`), no desde rutas profundas.
   - El móvil entra por la misma dirección (PIN escrito, o QR que apunta a la URL
     con el código). Pruébalo con dos pestañas/dispositivos antes de publicar.

> El stack lo dice el plan, no un gusto fijo. Prefiere lo más simple que cumpla:
> si no hace falta servidor, no lo metas; si hace falta tiempo real, un servidor
> Node pequeño con `ws` basta.

## Marca propia (obligatoria)

- **Nombre, colores y textos nuevos.** Nunca el nombre, el logo ni los textos del
  original. Define los tokens de color de tu marca y un nombre propio en el plan.
- Pasa `scripts/sweep.py` antes de publicar (ver abajo): es el candado.

## Medir y comparar

- **Parecido de funciones:** rellena `replica/funciones.csv` (formato en
  `scripts/funciones.ejemplo.csv`) mientras construyes y ejecuta:
  ```bash
  python scripts/parity.py replica/funciones.csv --markdown > replica/parecido.md
  ```
  Te dice qué % del original cubres, qué falta y en qué orden. No es publicable
  mientras falten funciones **imprescindibles**.
- **Original vs tu versión (maqueta):** con las capturas de REA del original y
  capturas equivalentes de tu versión:
  ```bash
  python scripts/imgdiff.py original.png tuversion.png --out diff.png
  ```
  El modo `layout` (por defecto) ignora el color (tu marca lo cambia a propósito) y
  mide la **estructura**. Súmalo al parecido con `parity.py --visual`.

## Candado de marca (antes de publicar)

```bash
python scripts/sweep.py . --avoid "<Nombre del original>" \
    --domains <dominio-del-original.com> --colors "<#color1,#color2>"
```
Sale con código 1 si encuentra el nombre, el dominio o los colores del original en
tu código (incluidos nombres de fichero y carpeta). **Reemplázalos todos antes de
publicar.** La carpeta `replica/` de planificación se salta (ahí el nombre del
original sí tiene sentido).

## Probar el recorrido principal

Antes de publicar, recorre tú el flujo principal de punta a punta en local
(servidor de previsualización; para tiempo real, levanta el servidor Node y abre
dos clientes). El build **no está hecho** hasta que ese recorrido pasa.
