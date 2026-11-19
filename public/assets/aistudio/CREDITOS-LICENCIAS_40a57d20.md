# Créditos y licencias

Esta skill (`adrian-saenz-copia-software`) usa y adapta dos proyectos con licencia
**MIT**. Se conservan sus avisos de copyright, como exige la MIT.

- **REA** — repositorio oficial `morluto/rea` (y `rea.tools` / paquete npm
  `rea-agents`). Es el **motor de lectura** (ingeniería inversa) que la skill
  instala con `npx rea-agents@latest setup`. Esta skill **no es oficial de REA ni
  está afiliada a REA**; instala REA siempre desde su fuente oficial.
- **replica-skill** — de Jake Schincariol
  (`https://github.com/Jakeschincariol/replica-skill`). De aquí se **adapta el
  método** (plan → construir → publicar) y los **scripts de ayuda** (`parity.py`,
  `sweep.py`, `imgdiff.py`, `reviews.py`), traducidos al español y ajustados al
  flujo de esta skill. Cada script lleva además su cabecera MIT.

---

## REA — MIT License

```
MIT License

Copyright (c) 2026 morluto

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

> Nota: REA incluye además herramientas de terceros (Ghidra, IDA, Hopper, JADX,
> etc.) con sus propias licencias; obtenerlas y usarlas legalmente es
> responsabilidad de quien las use.

---

## replica-skill — MIT License

```
MIT License

Copyright (c) 2026 Jake Schincariol

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
