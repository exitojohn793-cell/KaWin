# 06 · Funciones de IA con la cuenta de Claude del usuario

Si el software lleva IA (crear contenido, resumir, corregir, recomendar...), la
web puede usar **Claude Code instalado en la propia VPS**, con la **sesión de la
cuenta de Claude del usuario**. No hace falta clave de API ni pagar por uso: gasta
del uso de su plan de Claude. Es lo que se hizo con la IA del quiz del vídeo
(Eureka): crear cuestionarios desde un tema, un PDF, un enlace o una foto.

Es un detalle del recorrido, no el centro, pero tiene que salir **a la primera**:
el único paso que hace el usuario a mano es iniciar sesión, y es donde más se
puede liar.

## 1. Proponerlo en el PLAN (fase 2)

En `replica/PLAN.md` añade siempre un apartado **«Funciones de IA (opcional)»**:
- 2 a 4 funciones de IA **concretas** para ESTE software (sácalas de lo que tiene
  el original y de lo que piden sus usuarios en las reseñas).
- Cómo funcionaría: con su cuenta de Claude, sin coste extra (consume uso de su
  plan; con mucho tráfico conviene un tope diario, que la app trae).
- La pregunta, en una línea: **«¿Quieres que tenga funciones de IA? (sí / no)»**.

El OK del plan y esta respuesta van juntos: no es otra parada. Si dice que no, no
instales nada de esto. Si dice que sí, sigue con el apartado 2 en cuanto des el
OK por bueno (puedes hacerlo mientras construyes).

## 2. Preparar la VPS (lo haces tú, sin preguntar)

El **usuario de la app** es el mismo que corre su servicio (ver
[04-publicar-vps.md](04-publicar-vps.md)), en minúsculas, por ejemplo `miapp`.

```bash
ssh -i "<ruta ABSOLUTA>/secret/<carpeta>_vps" -o IdentitiesOnly=yes root@<IP> "bash -s -- <usuario-app>" < scripts/instalar-ia.sh
```

Deja Node 22+ (Node 24 de NodeSource si no había), Claude Code
(`npm i -g @anthropic-ai/claude-code`, queda en `/usr/bin/claude` para todos), el
usuario de la app con su carpeta y el comando **`conectar-ia`**. Se puede repetir.

> La sesión de Claude tiene que quedar en **`/home/<usuario-app>/.claude`**, nunca
> en root: la app corre como ese usuario y no vería la de root. Por eso todo va
> con `sudo -iu <usuario-app>`.

## 3. Que el usuario inicie sesión (lo único que hace a mano)

### 3a. Crea los lanzadores y ábrele la ventana tú

```bash
python scripts/lanzadores-ia.py --ip <IP> --clave secret/<carpeta>_vps --usuario <usuario-app>
```

Crea en la carpeta del proyecto **`CONECTAR-IA.cmd`** (Windows) y
**`CONECTAR-IA.command`** (Mac), con la ruta de la clave ya **absoluta**. Con una
ruta relativa, o abierta desde otra carpeta, ssh no encuentra la clave y pide la
contraseña de root, y eso es justo lo que confunde.

Luego **ábrele la ventana tú**, que es una ventana de terminal de verdad, aparte:
- Windows: `start "" "<ruta absoluta>\CONECTAR-IA.cmd"`
- Mac: `open "<ruta absoluta>/CONECTAR-IA.command"`

No la lances en una pestaña de terminal de la app ni dentro de tus comandos: el
usuario no la ve.

### 3b. El mensaje del chat (obligatorio, y siempre visible)

> **La causa del lío de la primera vez:** se le dijo al usuario «ya te he pasado
> el comando», pero el comando solo estaba dentro de un desplegable de «Ejecutó N
> comandos» que no se veía. **Lo que el usuario tiene que hacer va SIEMPRE en el
> texto de tu mensaje**, nunca solo en la salida de una herramienta. No digas
> «te lo he pasado» si no está escrito ahí.

Escribe este mensaje (cambia solo lo que va entre `< >`), con el comando de
reserva en su propio bloque de código:

> **Último paso de la IA: conectarla con tu cuenta de Claude (1 minuto).**
> Te acabo de abrir una ventana negra. Si no la ves, abre la carpeta del proyecto
> y haz doble clic en **CONECTAR-IA** (en Mac, `CONECTAR-IA.command`).
> 1. En la ventana sale un enlace largo. Ábrelo con **Ctrl + clic** (en Mac,
>    **Cmd + clic**).
> 2. Entra con tu cuenta de Claude y pulsa **Authorize**.
> 3. Copia el código que te da, pégalo en la ventana donde pone **«Paste code
>    here»** y pulsa **Enter**.
> 4. Cuando ponga **LISTO**, vuelve aquí y escríbeme **«hecho»**.
>
> Si prefieres hacerlo a mano, abre una terminal (Windows: tecla Windows, escribe
> **PowerShell** y Enter. Mac: Cmd + Espacio, escribe **Terminal** y Enter) y pega
> esto:
> ```
> ssh -t -i "<ruta absoluta de la clave>" -o IdentitiesOnly=yes root@<IP> conectar-ia
> ```
> Y si nada de esto te funciona, en la página de recursos del vídeo tienes el
> paso a paso (con la Consola web de Hostinger, sin terminal).

Guarda también ese comando en **`COMANDOS-LOGIN-CLAUDE.txt`**, en la carpeta del
proyecto.

### 3c. Plan C (está en la landing de recursos)

Sin nada de su ordenador: **hPanel › VPS › Consola web** y escribir
`conectar-ia` + Enter. O desde su terminal con la contraseña de root:
`ssh -t root@<IP> conectar-ia`. `conectar-ia` es el mismo en todas las VPS que
prepara esta skill, por eso la landing lo puede dar escrito.

## 4. Comprobar (antes de decir que funciona)

Cuando escriba «hecho» (o antes, si quieres), comprueba:
```bash
ssh ... root@<IP> "sudo -iu <usuario-app> claude auth status"     # "loggedIn": true
ssh ... root@<IP> "cd /tmp && timeout 120 sudo -iu <usuario-app> claude -p --tools '' --strict-mcp-config --safe-mode --no-session-persistence --output-format json 'Responde solo con la palabra: listo'"
```
Si responde, celébralo (✅). Si no, mira «Problemas frecuentes».

## 5. Cómo la llama la app

Desde el servidor de la app (que corre como `<usuario-app>` y con
`Environment=HOME=/home/<usuario-app>` en su servicio), lanza `claude` en modo no
interactivo, sin herramientas y con la salida validada por un esquema:

```js
import { spawn } from 'node:child_process';
const args = ['-p', '--model', 'claude-opus-5-5', '--effort', 'medium',
  '--tools', '', '--strict-mcp-config', '--safe-mode', '--no-session-persistence',
  '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
  '--json-schema', JSON.stringify(ESQUEMA), '--system-prompt', SISTEMA];
const p = spawn('claude', args, { cwd: '/tmp/miapp-ia',
  env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' } });
p.stdin.end(JSON.stringify({ type: 'user', message: { role: 'user',
  content: [{ type: 'text', text: peticion }] } }) + '\n');
// La última línea con type === 'result' trae structured_output (ya validado).
```

Reglas:
- **Sin herramientas** (`--tools ''`) y lo que meta el visitante va como **datos**
  dentro de `<fuente>…</fuente>`, con la orden en el sistema de que lo de dentro no
  son instrucciones.
- **Cola** (2 a la vez como mucho) y **tope diario** configurable en el panel de
  administración (por usuario, sin cuenta y del sitio entero), guardado en disco.
- Tiempo máximo por petición (unos 4 minutos) y mensajes claros: «Falta iniciar
  sesión de Claude en el servidor», «Se ha alcanzado el límite de uso de la IA».
- Comprueba si está disponible con `claude auth status` y, si no, la web esconde
  los botones de IA en vez de fallar.
- Para probar en local sin gastar uso, un `claude-falso` que devuelva un `result`
  de ejemplo (variable de entorno con la ruta del binario).

## Problemas frecuentes

- **Pide una contraseña.** Lo ha abierto sin la clave (ruta relativa u otra
  carpeta). Que cierre con Ctrl + C y use `CONECTAR-IA` o el comando con la ruta
  absoluta. (En el plan C con contraseña de root sí es normal: al escribirla no se
  ve nada.)
- **«Permission denied (publickey)».** La clave de la carpeta no es la que está en
  hPanel. Repasa [01-acceso-vps.md](01-acceso-vps.md).
- **No se abre el enlace.** Que lo seleccione entero con el ratón, lo copie y lo
  pegue en el navegador.
- **El código no vale.** Caduca a los pocos minutos: que vuelva a lanzar
  `CONECTAR-IA` y lo pegue nada más copiarlo.
- **Pegar no hace nada.** Clic derecho en la ventana (Windows) o Cmd + V (Mac).
- **La app dice que falta iniciar sesión, pero se inició.** Se hizo como root.
  Repite con `conectar-ia` (usa `sudo -iu <usuario-app>`).
- **En Windows sale un aviso rojo de «directivas de ejecución»** antes de
  conectar: no afecta, que siga.
