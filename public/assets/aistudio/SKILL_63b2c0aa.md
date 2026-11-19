---
name: adrian-saenz-copia-software
description: Crea TU PROPIO software partiendo de uno que ya funciona y lo deja publicado en tu VPS de Hostinger, en su propia dirección y con candado (HTTPS), usando solo el acceso SSH. Lee el software de referencia a fondo con REA, el motor oficial de ingeniería inversa (morluto/rea, que instala con `npx rea-agents@latest setup`). Mapea pantallas, recorridos, modelo de datos y lo que piden sus usuarios, con capturas. Te devuelve un PLAN para que lo apruebes (única parada) y luego construye el software completo con MARCA PROPIA y lo publica (webs estáticas o apps en tiempo real con Node y websockets), con IA opcional que usa tu cuenta de Claude. De un tirón, conecta tu VPS por SSH (pegas una clave en hPanel) → plan → construir → publicar. Úsala cuando quieras copiar, clonar, replicar o hacer tu propia versión de una app, web o programa que ya existe, partir de un software que ya factura, "hazme mi versión de X", "parte de este software/web/app", o "ingeniería inversa con REA". No es oficial de REA ni está afiliada.
---

# Copia software con Claude — una skill «one-shot»

Partes de un software que ya funciona y, de un tirón, acabas con **tu propia
versión, con tu marca, publicada en tu VPS de Hostinger**. El motor de lectura es
**REA** (el oficial, `morluto/rea`); el método (plan → construir → publicar) está
adaptado de **replica-skill** (ver [CREDITOS-LICENCIAS.md](CREDITOS-LICENCIAS.md),
se conservan los dos avisos MIT).

Dato técnico que ordena todo el enfoque: **REA no te devuelve el código
original**, te devuelve una comprensión con pruebas (lo que ha visto, lo que
deduce y lo que no sabe). Por eso lo que construyes es **siempre una versión
nueva**, no una copia del código.

## La regla de oro: una sola parada

Esto es un recorrido de un tirón con **una única parada**: el **PLAN** (fase 2).
Ahí enseñas el plan y esperas el OK del usuario. Antes y después, encadenas. (Hay
además una pausa técnica breve en la fase 1b: reiniciar Claude tras instalar REA;
no es una decisión, solo cerrar, abrir y relanzar.)

Pero **lee el estado en cada arranque** y no repitas lo ya hecho:
- ¿La VPS ya está conectada y verificada? → salta la fase 0.
- ¿REA ya está instalado y sus herramientas ya aparecen en la sesión (Claude
  reiniciado)? → salta las fases 1 y 1b y ve directo al análisis (fase 2).
  ¿Instalado pero sin que aparezcan aún? → pide reiniciar (fase 1b).
- ¿El plan ya está aprobado (existe `replica/PLAN.md` con el OK)? → ve a construir.
- ¿Ya está construido? → ve a publicar.

## Lo que pides y lo que no

- **Conectar o tocar la VPS** (SSH) sale del ordenador hacia su servidor:
  anúncialo y espera un sí claro. En la fase 0, que el usuario te pase su nombre
  de host y su acceso root ya es ese sí (generar la clave antes no sale del
  ordenador y no necesita permiso).
- **REA se instala siempre, sin preguntar.** Es parte del recorrido: anúncialo en
  una línea y hazlo (fase 1). No ofrezcas alternativas sin REA.

Todo lo demás (entender el plan, construir en local, verificar) lo haces sin
frenar. La clave privada y la contraseña de root **nunca salen del ordenador**.

## Solo por SSH: la cuenta de Hostinger no se toca

La skill trabaja **solo con lo que el usuario le da** (host + IP de su VPS y la
clave que pega en hPanel) y con lo que ve **dentro de la VPS por SSH**. Aunque en
el equipo haya conectores o acceso a la cuenta de Hostinger (listar VPS, DNS,
dominios...), **no los uses ni los menciones**: no listes servidores ni dominios
del usuario y no toques su DNS. Así el recorrido es el mismo para cualquiera que
lo use por primera vez.

Por eso **no se pide ningún dominio**: solo con SSH no se puede hacer que un
dominio apunte a la VPS (eso se cambia en el DNS, fuera del servidor). Se publica
en el **nombre propio de la VPS** (`srvXXXXXXX.hstgr.cloud`, el que el usuario da
en la fase 0), que ya apunta a la máquina y admite candado.

---

## El flujo (en orden)

### Fase 0 · Acceso a la VPS — lo primero de todo
Todo se va a alojar en el hosting del usuario, así que **lo primero es conectar su
VPS de Hostinger por SSH**. Mismo proceso que el recurso de AS Video Studio, pero
para cualquier software. Detalle completo en
[referencias/01-acceso-vps.md](referencias/01-acceso-vps.md). En resumen:

1. **Sin preguntar nada antes**, genera una clave **ed25519 sin frase de paso** en
   `secret/`, restringe permisos (`icacls` en Windows), crea `.gitignore` (ignora
   `secret/` y `*_vps`) y deja `secret/LEEME-SEGURIDAD.txt`.
2. En tu **primera respuesta**, imprime la clave **PÚBLICA** en un bloque de **una
   sola línea** y, en ese mismo mensaje, pide dos cosas: que la pegue en **hPanel ›
   VPS › Clave SSH** (enlace «Administrar» › «+ Clave SSH» › Guardar) y que, cuando
   la haya guardado, te pase el **Nombre de host** (`srvXXXXXXX.hstgr.cloud`) y el
   **Acceso root** (`ssh root@IP`) de la vista general de su VPS.
3. Cuando te pase esos dos datos (esa es la señal de que la clave ya está
   guardada: no le pidas que escriba «guardada»), verifica la conexión con
   `scripts/vps.sh`, muestra **hostname + uptime** y deja el runbook en `CLAUDE.md`.

> La clave privada y la contraseña de root **no se comparten nunca**. Solo sale la
> pública, y la pega siempre el usuario en hPanel: tú no la instalas por otra vía.

### Fase 1 · Instalar el motor REA
Instala el **REA oficial** siempre, sin preguntar (anúncialo en una línea). Elige
el cliente (`claude_code` para la app de Claude Code, `claude_desktop` para Claude
Desktop), aplícalo y **reinicia el cliente** para que aparezcan sus herramientas:
```
npx -y rea-agents@latest doctor --client claude_code --json    # diagnostico (solo lee)
npx -y rea-agents@latest setup  --client claude_code --yes      # instala y registra
```
Cuidado con las copias: el oficial es `morluto/rea` / `rea.tools` / npm
`rea-agents`. Node 22.19+/24.11+/26+ (compruébalo con `node -v`). Luego **descubre sus
herramientas en tiempo de ejecución** con `tools/list` (sus nombres cambian entre
versiones; no los des por fijos). Comprobado contra **REA 6.7.0** (207
herramientas). Cómo y qué extraer con cada tipo de software, en
[referencias/02-motor-rea.md](referencias/02-motor-rea.md).

### Fase 1b · Reiniciar Claude (una vez, tras instalar REA)
Instalar REA deja la herramienta puesta, pero **Claude solo la detecta al
arrancar**. En cuanto REA quede instalado y registrado, **para y pídeselo al
usuario** con palabras sencillas:
> He instalado REA. **Cierra Claude del todo y vuelve a abrirlo**, y lánzame otra
> vez (`/adrian-saenz-copia-software`). Me acuerdo de lo que ya hicimos.

Al relanzarte, comprueba que las herramientas de REA ya aparecen (su lista real,
`tools/list`). Como la clave de la VPS quedó guardada y REA ya está instalado,
**continúa directo al análisis (fase 2)** sin repetir nada. Si las herramientas
aún no aparecen, revisa el registro
([referencias/02-motor-rea.md](referencias/02-motor-rea.md)) antes de seguir.

### Fase 2 · Análisis a fondo + PLAN — la única parada
Apunta REA al software de referencia y **léelo a fondo, sin topes**: pantallas,
recorridos, componentes, red, modelo de datos, con capturas. Reúne reseñas del
original y pásalas por `scripts/reviews.py` para saber **qué piden sus usuarios**.
Vuelca todo en la carpeta de trabajo `replica/`.

Entrega **`replica/PLAN.md`** con:
- Qué hace el software y para quién.
- **Mapa de pantallas y recorridos, con capturas** (esto solo lo da REA).
- Modelo de datos.
- **Stack propuesto**: estático, o con servidor propio / tiempo real (Node +
  websockets) si el software lo pide. Ver [referencias/03-construir.md](referencias/03-construir.md).
- Lo que el original **no** tiene y tú **sí** vas a tener (de las reseñas).
- **Marca propia** propuesta: nombre, colores, tono (nunca el nombre del original).
- Qué se va a construir y **cuánto cuesta** (un finde / unas semanas).
- **Funciones de IA (opcional)**: propón 2-4 concretas para este software, que
  funcionarían con su cuenta de Claude sin coste extra, y pregunta en una línea
  **«¿Quieres que tenga funciones de IA? (sí / no)»**. Ver
  [referencias/06-ia-con-claude.md](referencias/06-ia-con-claude.md).

**Para aquí y espera el OK del usuario** (o cambios) y su sí o no a la IA. Es la
única parada: las dos respuestas van en el mismo mensaje.

### Fase 3 · Construir (tras el OK)
Con el plan aprobado, construye el software **completo** y con **marca propia**:
1. El **recorrido principal de punta a punta** primero; luego el resto; luego las
   mejoras del plan.
2. Stack y convenciones en [referencias/03-construir.md](referencias/03-construir.md)
   (estático, o servidor Node/Python; apps en tiempo real con websockets).
3. Prueba el recorrido principal en local (servidor de previsualización).
4. Mide el **parecido** con `scripts/parity.py` (+ `funciones.csv`) y compara
   **original vs tu versión** con `scripts/imgdiff.py` sobre las capturas de REA.
5. **Candado de marca**: pasa `scripts/sweep.py`. Si queda el nombre, el dominio o
   los colores del original, **no se publica** hasta reemplazarlos.

### Fase 3b · Funciones de IA (solo si dijo que sí)
La web usa **Claude Code instalado en su VPS** con **su cuenta de Claude**. Detalle
completo, mensaje literal y problemas frecuentes en
[referencias/06-ia-con-claude.md](referencias/06-ia-con-claude.md). En resumen:
1. Prepara la VPS tú, sin preguntar: `scripts/instalar-ia.sh <usuario-app>` (Node,
   Claude Code, el usuario de la app y el comando `conectar-ia`).
2. Crea `CONECTAR-IA.cmd` / `CONECTAR-IA.command` con `scripts/lanzadores-ia.py`
   (ruta de la clave absoluta) y **ábrele la ventana tú** (`start` / `open`).
3. En el **texto de tu mensaje** (nunca solo dentro de un comando que ejecutas)
   le dices los 4 pasos: abrir el enlace, Authorize, pegar el código, escribirte
   «hecho». Con el comando de reserva en un bloque de código y la landing como
   plan C (`conectar-ia` en la Consola web de hPanel).
4. Comprueba `claude auth status` (`"loggedIn": true`) y una respuesta real
   antes de decir que funciona. La sesión vive en el usuario de la app, nunca en root.

### Fase 4 · Publicar en la VPS del usuario
Despliega en **su VPS, en su propia dirección**: `https://srvXXXXXXX.hstgr.cloud`
(el nombre de host de la fase 0). No se pide dominio. Detalle en
[referencias/04-publicar-vps.md](referencias/04-publicar-vps.md):
- Estático → copiar al servidor y servir por nginx.
- Con servidor / tiempo real → servicio `systemd` escuchando en `127.0.0.1`,
  nginx como proxy (con cabeceras de **websocket** si hace falta), y certificado
  **Let's Encrypt** (candado) para ese nombre.
- Si ese nombre ya sirve otro proyecto en la VPS, no lo pises: publica en una
  subcarpeta, `https://srvXXXXXXX.hstgr.cloud/<proyecto>/`.
- Si el usuario pide «con mi dominio», explícale en una frase que se publica en el
  nombre de su VPS, que ya es suyo y lleva candado. Hacer que un dominio apunte a
  la VPS se hace en su DNS, y eso la skill no lo toca.
- Verifica la **URL viva** (200 + candado) antes de cantar victoria.
- Respeta lo que ya hubiera en la VPS: copia de seguridad antes de pisar nada y
  toca solo lo del proyecto.

---

## Invariantes (valen en todo el recorrido)

**Comunicación.** El usuario **no es técnico**. Cero jerga (nada de «proxy»,
«endpoint», «systemd», «MCP»); di «el servidor que corre tu app», «el aviso del
candado». Ejecuta tú los comandos; lo único que el usuario hace a mano es pegar la
clave en hPanel, iniciar sesión de Claude si quiere IA, y aprobar lo que cambie
su equipo o su VPS. Todo lo que tenga que hacer él va **escrito en tu mensaje**,
nunca solo dentro de la salida de un comando. Anuncia antes de
actuar, celebra los hitos (✅), nunca enseñes un error en crudo y **verifica antes
de afirmar**.

**Seguridad.** La clave privada SSH y la contraseña de root **jamás salen del
ordenador**; solo se comparte la pública. `.gitignore` excluye `secret/` y
`*_vps`. Nada de secretos ni claves de API dentro del repositorio del proyecto.

**Marca propia, obligatoria.** Lo que publicas lleva **nombre, colores y textos
nuevos**. El candado (`sweep.py`) es la última comprobación antes de publicar.

**Legal y atribuciones: las explica Adrián en el vídeo, no las impone la skill.**
La skill no bloquea ni sermonea sobre permisos o licencias (eso lo cuenta el
vídeo). Su única garantía dura es que lo que sale tiene **marca propia** y que es
una **implementación nueva** (REA no da el código original). Ver
[referencias/05-marca-y-legal.md](referencias/05-marca-y-legal.md).

**REA es de terceros.** No es una skill oficial de REA ni está afiliada. Instala
REA siempre desde su fuente oficial. Se conservan los avisos MIT de REA y de
replica-skill ([CREDITOS-LICENCIAS.md](CREDITOS-LICENCIAS.md)).

---

## Entorno

- **REA** necesita Node **22.19+ / 24.11+ / 26+** y un Chrome para mirar webs.
- Los **scripts de ayuda** son Python 3 (solo librería estándar; sin dependencias).
- El **software que construyes** corre en la VPS del usuario: estático, o con su
  propio servidor (Node/Python). No hace falta nada de pago extra por parte de la
  skill.

## Índice de ficheros

```
SKILL.md                         ← esto: el flujo one-shot
README.md                        ← orden de uso, de principio a fin
CREDITOS-LICENCIAS.md            ← los dos avisos MIT (REA + replica-skill)
referencias/
  01-acceso-vps.md               ← conectar la VPS por SSH (clave que pega el usuario)
  02-motor-rea.md                ← instalar REA + descubrir herramientas + qué extraer
  03-construir.md                ← stack y convenciones (estático / servidor / tiempo real)
  04-publicar-vps.md             ← nginx + certbot + systemd en la VPS del usuario
  05-marca-y-legal.md            ← marca propia; lo legal lo cuenta el vídeo
  06-ia-con-claude.md            ← funciones de IA con la cuenta de Claude del usuario
scripts/
  parity.py                      ← % de funciones del original que ya cubres
  sweep.py                       ← candado de marca antes de publicar
  imgdiff.py                     ← comparar original vs tu versión (capturas)
  reviews.py                     ← rankear lo que piden los usuarios del original
  temas-resenas.json             ← temas (ES/EN) para reviews.py
  funciones.ejemplo.csv          ← ejemplo de matriz de funciones para parity.py
  vps.sh                         ← lanzar comandos en la VPS por SSH
  instalar-ia.sh                 ← prepara la IA en la VPS (Claude Code + conectar-ia)
  lanzadores-ia.py               ← crea CONECTAR-IA.cmd / .command para iniciar sesión
tests/                           ← pruebas de los scripts (python -m unittest)
```

## Nota final

Una sola skill, un solo recorrido, una sola parada. Le dices de qué software
partir, le das acceso a tu VPS, te enseña un plan, tú das el OK, y acabas con tu
propia versión publicada y con tu marca. Lo difícil ya no es tener el software;
es elegir bien, mejorar lo que el original no hace y venderlo.
