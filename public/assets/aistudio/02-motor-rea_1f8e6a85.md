# 02 · El motor REA (instalar + descubrir herramientas + qué extraer)

REA es el motor de **lectura a fondo**: conecta Claude Code con las herramientas de
ingeniería inversa (Ghidra/IDA/Hopper/Kuna para binarios, JADX para Android, y su
propio análisis de webs y apps JS/Electron). Te devuelve **una comprensión con
pruebas** (lo que ha visto, lo que deduce y lo que no sabe), **no el código
original**. Por eso lo que construyes luego es una versión nueva.

> **Comprobado contra REA 6.7.0** (su skill `reverse-engineer-anything` v42, **207
> herramientas MCP**, 153 comandos CLI) el 19-10-2026, con
> `npx -y rea-agents@6.7.0 doctor --json`. REA saca versión muy a menudo y
> **renombra herramientas entre versiones**, así que lo de abajo es la referencia
> de 6.7.0; en cada sesión usa la lista real del servidor (ver «Descubre...»).

## Instalar (siempre, sin preguntar)

REA se instala **siempre**: es parte del recorrido. Anúncialo en una línea y
hazlo; no pidas permiso ni ofrezcas seguir sin REA. Fuente oficial, cuidado con las copias: **`morluto/rea`** / `rea.tools` / el
paquete npm **`rea-agents`** (`mcpName: io.github.morluto/rea`). Node **22.19+ /
24.11+ / 26+** y npm. Esta skill **no es oficial de REA ni está afiliada**.

Pasos, eligiendo el cliente — para la app de escritorio de Claude Code usa
**`claude_code`**; Claude Desktop es **`claude_desktop`** (otros: `codex`,
`cursor`, `gemini_cli`, `windsurf`, `vscode`, ...):

1. **Diagnóstico (solo lectura):** `npx -y rea-agents@latest doctor --client claude_code --json`.
2. **Instalar y registrar:** `npx -y rea-agents@latest setup --client claude_code --yes`.
3. **Reiniciar el cliente** (cierra y abre Claude Code / Claude Desktop) para que las herramientas de REA aparezcan en la sesión. `setup` registra el servidor MCP; instalar solo la skill **no** lo registra. La skill convierte esto en una **parada explícita** (fase 1b): pide al usuario cerrar y reabrir Claude y relanzarla, y al volver comprueba con `tools/list` que las herramientas están antes de empezar el análisis.

Notas:
- **REA no instala ni actualiza** Node, npm, Java, Ghidra, IDA, JADX, Kuna, etc.
  Los motores de binarios y Android son «trae lo tuyo» y se enganchan por variables
  de entorno (`GHIDRA_INSTALL_DIR`, `HOPPER_LAUNCHER_PATH`, `REA_IDA_MCP_CONFIG`,
  `REA_JADX_MCP_JAR`, `REA_KUNA_COMMAND`). Para **webs y apps JS/Electron no hacen
  falta** esos motores.
- Para mirar **webs**, REA necesita un **Chrome** (familia Chromium) con un endpoint
  CDP de loopback; en Windows, con depuración remota o el navegador que lance REA.
- **Atajo sin registrar MCP** (útil para probar rápido una app JS/ASAR):
  `npx -y rea-agents@latest analyze-javascript-application /ruta/app --json`.

## Descubre las herramientas EN TIEMPO DE EJECUCIÓN

Los nombres **cambian entre versiones**. **No los des por fijos.** La propia REA lo
avisa: «usa la lista real de herramientas del servidor conectado y sus esquemas de
entrada; una skill de la rama main puede describir capacidades ausentes en una
versión npm más vieja». En cada sesión:

- Usa `tools/list` del servidor REA conectado para los nombres y esquemas
  canónicos, o `binary_session` con `{}` (su `result.tool_availability` dice qué
  hay y por qué). Elige la herramienta por lo que hace, no por el nombre memorizado.

## Las herramientas por tipo de objetivo (verificadas en 6.7.0)

**Web** (lo más habitual para el demo del canal):
- `list_browser_targets` → `inspect_web_page` u `observe_web_session` (cuando el
  recorrido lo hace el usuario en su navegador).
- `capture_browser_scenario` (cuando el recorrido lo hace REA: clic, escribir,
  navegar; con acciones declaradas).
- `capture_web_screenshot` (capturas de píxeles para el mapa y para `imgdiff.py`).
- `observe_web_execution`, `inspect_web_event_listeners`, `compare_web_captures`,
  `discover_webmcp_tools`.
- `inspect_web_network_capture` (capturas HAR/SAZ/mitmproxy/qlog ya guardadas).

**App JavaScript / Electron**:
- `analyze_javascript_application` (ASAR o árbol JS; también por CLI).
- `trace_application_feature`, `compare_application_versions`,
  `compare_javascript_export_shapes`.
- Electron en marcha: `list_electron_targets`, `inspect_electron_fuses`.

**Android (APK)**: `inspect_android_package`, `inspect_android_class`,
`inspect_android_method`, `trace_android_references`.

**.NET / managed**: `inspect_managed_artifact`, `inspect_managed_members`.

**Binario nativo** (Ghidra/Hopper/IDA/Kuna): `open_binary`, `binary_overview`,
`analyze_function`, `binary_session`, `inspect_artifact`, `list_segments`,
`inspect_macho`, `compare_functions`, `extract_artifact`, `close_binary`, entre
otras.

**WebAssembly**: `inspect_wasm_artifact`, `compare_wasm_interfaces`.

**Otros objetivos locales**: `inspect_sqlite_database`, `inspect_go_binary`,
`inspect_rust_binary`, `inspect_pe_resources`, `inspect_binary_layout`,
`inspect_evm_interface`, y capturas de red/paquetes/señales.

**Evidencia (compartido)**: `inspect_analysis_view`, `get_evidence_bundle`,
`export_evidence_bundle`, `compare_artifacts`. REA trabaja «resumen primero»: pide
`detail: "summary"` y pagina la evidencia retenida con `inspect_analysis_view`.

## Qué extraer (para el PLAN de la fase 2)

Lee **a fondo, sin topes**, y vuelca en la carpeta `replica/`:
1. **Mapa de pantallas y recorridos** con **capturas** (`capture_web_screenshot` /
   `capture_browser_scenario`); úsalas también para `imgdiff.py`. Esto es lo que
   diferencia el trabajo: enséñalo.
2. **Modelo de datos**: entidades, campos, relaciones deducidas.
3. **Funciones** del recorrido principal y de los secundarios → `replica/funciones.csv`
   (formato en `scripts/funciones.ejemplo.csv`) para medir el parecido con `parity.py`.
4. **Lo que no se sabe**: dilo en el plan, no lo inventes (REA distingue siempre
   observación, deducción e incógnita; cita las Evidence IDs).

> Recuerda: REA explica **cómo funciona**, no te da el código. Lo que construyas en
> la fase 3 es una implementación nueva, con tu marca.
