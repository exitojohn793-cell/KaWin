# 01 · Acceso a la VPS por SSH (lo primero de todo)

Todo el software se va a alojar en la VPS de Hostinger del usuario, así que **lo
primero** es conectar Claude a esa VPS por SSH. Es el mismo proceso del recurso de
AS Video Studio, pero sirve para cualquier software.

> **El orden importa.** Generar la clave no sale del ordenador, así que se hace
> **antes de preguntar nada**. Conectar a la VPS sí sale: solo lo haces cuando el
> usuario te pasa sus dos datos, y eso cuenta como su sí. La clave privada y la
> contraseña de root **nunca salen del ordenador**: solo se comparte la pública.

## 1. El recorrido, de un vistazo

1. Generas la clave y proteges `secret/` (apartados 2 y 3), sin preguntar.
2. En tu **primera respuesta** le das la clave **pública** y, en el mismo
   mensaje, le pides que la pegue en hPanel y que **después** te pase sus dos
   datos (apartados 4 y 5).
3. Con los dos datos, verificas y dejas el runbook (apartados 6 y 7).

Los dos datos que te da el usuario (de hPanel › Vista general de su VPS):

- **Nombre de host**: con la forma `srvXXXXXXX.hstgr.cloud`.
- **Acceso root**: la línea `ssh root@XXX.XXX.XXX.XXX` → de ahí sacas la **IP**.

No le pidas nada más. (Si prefiere, puede dártelos pegando esa sección de
hPanel.) Con ellos basta para todo, también para publicar: el nombre de host será
la dirección pública del proyecto (`https://srvXXXXXXX.hstgr.cloud`). **No le
pidas que escriba «guardada»**: que te pase los dos datos ya significa que la
clave está guardada.

> **No pidas dominio** y **no uses la cuenta de Hostinger** del usuario
> (conectores o API para listar VPS, DNS o dominios), aunque estén disponibles en
> el equipo. Ni los menciones: todo sale de estos dos datos y del SSH.

## 2. Generar la clave (ed25519, sin frase de paso)

Llama `<carpeta>` al nombre de la carpeta del proyecto. La clave va en `secret/`.

**Windows (PowerShell):**
```powershell
mkdir secret -Force | Out-Null
ssh-keygen -t ed25519 -f "secret\<carpeta>_vps" -N '""' -C "claude-code-<carpeta>"
# Restringir permisos (si no, ssh en Windows puede rechazar la clave):
icacls "secret\<carpeta>_vps" /inheritance:r /grant:r "$($env:USERNAME):R"
```

**Mac / Linux / Git Bash:**
```bash
mkdir -p secret
ssh-keygen -t ed25519 -f secret/<carpeta>_vps -N "" -C "claude-code-<carpeta>"
chmod 600 secret/<carpeta>_vps
```

La clave **sin frase de paso** es a propósito: hace falta para desplegar sin que
nadie teclee nada cada vez.

## 3. Proteger la carpeta `secret/`

Crea (o actualiza) `.gitignore` en la raíz de la skill/proyecto:
```
secret/
*_vps
```
Y deja un `secret/LEEME-SEGURIDAD.txt`:
```
Esta carpeta contiene la clave SSH PRIVADA de tu VPS. Da acceso ROOT.
- No la subas a git ni a ningún sitio público. El .gitignore ya la excluye.
- No la pegues en el chat ni la envíes por correo/mensajería.
- Solo se comparte la clave PÚBLICA (el fichero .pub), que es la que pegas en hPanel.
- Si crees que se ha filtrado: borra la clave en hPanel › VPS › Clave SSH,
  genera otra con esta misma skill y sustituye el fichero.
```

## 4. Imprimir la clave PÚBLICA (una sola línea)

```bash
cat secret/<carpeta>_vps.pub        # Mac/Linux/Git Bash
```
```powershell
Get-Content "secret\<carpeta>_vps.pub"   # Windows
```
Enséñala en el chat en un **bloque de código de una sola línea**, para que el
usuario la copie entera de un toque.

## 5. El usuario la pega en hPanel

En el mismo mensaje de la clave, dile, con estas palabras:
> Entra en **hPanel › VPS › Clave SSH** (en la vista general de la VPS, la
> tarjeta **«Clave SSH · Administrar»**), pulsa **«+ Clave SSH»**, pega la clave
> que te acabo de dar y dale a **Guardar**. Cuando esté guardada, vuelve aquí y
> pásame estos dos datos de la vista general de tu VPS: el **Nombre de host**
> (`srvXXXXXXX.hstgr.cloud`) y el **Acceso root** (`ssh root@XXX.XXX.XXX.XXX`).

> La clave la pega siempre el usuario en hPanel. (Si la máquina ya
> tenía otra clave y la pegas tú por consola con `echo >>`, cuidado: el
> `authorized_keys` de Hostinger puede quedar sin salto de línea y juntar dos
> claves en una; por eso mejor que la pegue el usuario por el panel.)

## 6. Verificar la conexión (hostname + uptime)

Con `VPS_HOST` apuntando a la IP:

```bash
VPS_HOST=<IP> bash scripts/vps.sh          # muestra hostname + uptime
```
O directo, sin el helper:
```bash
ssh -i secret/<carpeta>_vps -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new root@<IP> "hostname; uptime -p || uptime"
```
Si responde con el nombre de la máquina y su tiempo encendida, **estás dentro**.
Celébralo (✅) y pasa a la fase 1.

## 7. Dejar el runbook en `CLAUDE.md`

Para no reinventar la conexión en cada arranque, guarda en `CLAUDE.md` (del
proyecto) algo así:
```
## Conexión a la VPS
- Host:  srvXXXXXXX.hstgr.cloud   (también la dirección pública: https://srvXXXXXXX.hstgr.cloud)
- IP:    <IP>
- User:  root
- Clave: secret/<carpeta>_vps  (privada, NO sale del PC; pública ya pegada en hPanel)
- Conectar:  ssh -i secret/<carpeta>_vps -o IdentitiesOnly=yes root@<IP>
- Copiar:    scp -i secret/<carpeta>_vps -r <local> root@<IP>:<remoto>
- Helper:    VPS_HOST=<IP> bash scripts/vps.sh "<comando remoto>"
```

## Problemas frecuentes

- **`UNPROTECTED PRIVATE KEY` (Windows):** faltan permisos → repite el `icacls` del
  paso 2.
- **`Permission denied (publickey)`:** la pública aún no está guardada en hPanel, o
  se pegó mal (debe ser UNA línea). Pide al usuario que la vuelva a pegar.
- **Se agota el tiempo:** comprueba la IP (hPanel › Vista general) y que la VPS
  esté encendida.
