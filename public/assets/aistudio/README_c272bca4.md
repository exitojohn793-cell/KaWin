# adrian-saenz-copia-software

Una skill de Claude Code que, partiendo de un software que ya funciona, lo lee a
fondo con **REA**, te enseña un **plan**, y luego construye **tu propia versión con
tu marca** y la **publica en tu VPS de Hostinger**. Todo de un tirón, con **una
sola parada**: cuando te enseña el plan.

El comando es **`/adrian-saenz-copia-software`**.

## Qué necesitas

- **Claude Code** (app de escritorio) con tu plan de Claude.
- **Node.js 22.19+ / 24.11+ / 26+** (lo pide REA) y un **Chrome** para mirar webs.
- **Python 3** (para los scripts de ayuda; solo librería estándar, sin instalar nada).
- Una **VPS de Hostinger** tuya (el recurso de referencia recomienda un KVM 4).
  No hace falta dominio: se publica en el nombre propio de la VPS
  (`srvXXXXXXX.hstgr.cloud`), con candado. La skill solo entra en tu VPS por SSH;
  no toca tu cuenta de Hostinger.

## Cómo instalarla

Copia esta carpeta donde tengas tus skills de Claude Code. Si tu forma de cargar
skills exige que el nombre de la carpeta coincida con el de la skill, renómbrala a
**`adrian-saenz-copia-software`** (el `name:` del `SKILL.md`). El comando seguirá
siendo `/adrian-saenz-copia-software`.

## El orden de uso (de principio a fin)

La skill va sola; esto es lo que pasa y lo único que tú haces a mano:

1. **Acceso a tu VPS (lo primero).** Generará una clave de acceso en `secret/` y
   te enseñará la parte **pública** en una línea. Tú la **pegas en hPanel › VPS ›
   Clave SSH** (+ Clave SSH › Guardar) y le pasas el **Nombre de host** y el
   **Acceso root** de tu VPS (están en hPanel › Vista general). Verificará la
   conexión. *Tu clave privada y tu contraseña de root nunca salen de tu ordenador.*
2. **Instalar REA.** La skill instala sola el motor de lectura, sin preguntarte.
3. **Reiniciar Claude (una vez).** En cuanto REA quede instalado, la skill te
   pedirá **cerrar y abrir Claude** y volver a lanzarla (así Claude ve la
   herramienta nueva). No se pierde nada: recuerda lo ya hecho (tu llave de la VPS
   sigue guardada) y continúa sola.
4. **El plan (única parada).** Le dices de qué software partir. Lo desmonta a fondo
   y te enseña un **plan**: qué hace, mapa de pantallas con capturas, datos, stack,
   lo que sus usuarios piden y que tú sí tendrás, la marca propia y cuánto cuesta.
   **Tú lees y das el OK** (o pides cambios). Ahí mismo te propone **funciones de
   IA** para tu software y te pregunta si las quieres.
5. **Construir.** Monta el software completo con tu marca. Sirve webs estáticas y
   también apps en **tiempo real** (p. ej. un quiz en vivo con PIN/QR desde el
   móvil): servidor Node con websockets.
   Si quisiste IA, la conecta a **tu cuenta de Claude** (sin pagar API): te abre
   una ventana, abres el enlace, pulsas *Authorize*, pegas el código y listo. Si
   no la ves, doble clic en `CONECTAR-IA` dentro de la carpeta del proyecto.
6. **Publicar.** Lo deja en tu VPS, en su propia dirección
   (`https://srvXXXXXXX.hstgr.cloud`) y con candado. Te da la URL viva.

Lo único que tocas a mano: pegar la clave en hPanel, pasarle dos datos de tu VPS,
**reiniciar Claude una vez**, aprobar el plan y, si quieres IA, iniciar sesión de
Claude en la ventana que te abre. El resto lo hace
la skill.

## Los scripts de ayuda (`scripts/`)

Los ejecuta la skill por ti; no tienes que tocarlos. Están adaptados de
replica-skill (MIT) y traducidos:

- `parity.py` — qué % de las funciones del original cubre ya tu versión.
- `imgdiff.py` — compara **original vs tu versión** pantalla a pantalla.
- `reviews.py` — ordena **lo que piden** los usuarios del original (con enlaces).
- `sweep.py` — el **candado de marca**: no deja publicar si queda algo del original.
- `vps.sh` — lanza comandos en tu VPS por SSH.
- `instalar-ia.sh` — deja Claude Code en tu VPS para la IA de tu web (solo si la quieres).
- `lanzadores-ia.py` — crea `CONECTAR-IA`, el doble clic para conectar la IA con tu cuenta de Claude.

## Pruebas (para quien toque el código)

Los scripts llevan pruebas. Desde esta carpeta:

```bash
python -m unittest discover -s tests
```

## Créditos y licencias

- Motor de lectura: **REA** (`morluto/rea`, MIT). Esta skill **no es oficial de REA
  ni está afiliada**; instala REA siempre desde su fuente oficial.
- Método y scripts: adaptados de **replica-skill** (Jake Schincariol, MIT).

Los dos avisos MIT completos están en
[CREDITOS-LICENCIAS.md](CREDITOS-LICENCIAS.md). Lo legal y las atribuciones de tu
proyecto las explica Adrián en el vídeo; la skill solo garantiza que lo que
publicas lleva **marca propia**.
