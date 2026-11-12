# CLAUDE.md

Guía para Claude Code al trabajar en **pensilpos-ticket-backend**: el servicio **local** que imprime los tickets de venta de Pensil.Pos en impresoras térmicas ESC/POS. Corre en el PC del negocio (puerto 3000), normalmente instalado como servicio de Windows. **No se despliega en la nube.** El README es la presentación para quien lo instala; este archivo, las reglas para trabajar en el código.

## Comandos

```bash
npm install                          # no hay package-lock.json versionado (está en .gitignore): ver "Pendientes"
cp .env.example .env                 # PORT, NODE_ENV, PRINTER_NAME, PAPER_SIZE
npm run dev                          # nodemon src/app.js
npm start                            # node src/app.js
npm test                             # Jest unitario (tests/)
npm run test:coverage                # unitario con cobertura (coverage/)
npm run test:integration             # integración: supertest contra la app real (tests-integration/)
npm run test:integration:coverage    # integración con cobertura (coverage-integration/)
npx jest tests/helpers/ticket-builder.helper.test.js   # un archivo
node node-service.js --install       # instala e inicia el servicio de Windows (terminal como Administrador)
node node-service.js --uninstall     # lo detiene y desinstala
```

No hay linter ni formateador configurados (ni ESLint ni Prettier): respeta el estilo del archivo que tocas (indentación, comillas, `;`). Ejemplos de peticiones en `rest-client.http`.

## Qué hace y quién lo llama

- Lo llama `pensilpos-frontend` (`dashboard/sales/services/thermal-printer.service.ts`, `environment.API_TICKET_URL` = `http://localhost:3000/api`) **solo** para los establecimientos con `ticket_print_method: 'LOCAL_SERVICE'` (lo configura el super admin). El resto imprime con el diálogo del navegador.
- `POST /api/printer/print-ticket` — ticket de venta. `POST /api/printer/print-kitchen-ticket` — comanda de cocina, **obsoleta** (`@deprecated`): el frontend ya no la imprime; se conserva hasta decidir si se retoma o se elimina. No la amplíes.
- **El contrato lo comparte con el frontend:** los nombres de los campos (`establishment_*`, `waiter_name`, `sale_data.products[].product_name/count/sale_price/total_item_value/product_note/sale_unit`, `sale_data.total`, `sale_data.delivery_cost`, `sale_data.billiard_sale.*`, `sale_data.client.name`) no se cambian aquí sin cambiar `thermal-printer.service.ts` en el mismo cambio. Errores de validación: 400 `{ ok: false, message, errors }`; fallos de impresora: 500/503 con `msg` en español, que el frontend muestra.

## Arquitectura (capas, sin hexagonal)

```text
src/
├── app.js                 entrada: new Server().listen()
├── config/                config.js (lee .env una vez al cargar), paper-sizes.js (perfiles de papel), server.js (Express: cors, json 20mb, rutas)
├── routes/                printer.routes.js: cadena de middlewares por endpoint
├── middlewares/           validate-printer (la impresora de PRINTER_NAME existe) → check() de express-validator → validate-fields (400)
│                          → validate-ticket-data / validate-kitchen-ticket-data (mapean el body a req.ticket en camelCase)
├── controllers/           printer.controller.js: arma el ticket y lo imprime en cola (withPrintLock)
└── helpers/               ticket-builder / kitchen-ticket-builder (ESC/POS con @point-of-sale/receipt-printer-encoder + canvas),
                           printer.helper (envía y espera 'printed' con timeout de 2 s), printer-queue.helper (limpia la cola de Windows),
                           sale-validation.helper
```

Reglas que no se deben romper:

- **Una impresión a la vez.** El controlador encadena las impresiones con `withPrintLock` (un semáforo en memoria): si una falla, solo recibe el error quien la pidió y la cola sigue. No imprimas por fuera de ese lock.
- **Los montos llegan calculados.** El total de cada línea (`total_item_value`) y el de la venta (`sale_data.total`) vienen del frontend y el ticket solo los imprime: no los recalcules. Una línea por peso (`sale_unit: 'WEIGHT'`, backend SPEC-051) trae la cantidad en **gramos** y el precio **por kg**; se imprime el total en la fila y debajo `1,250 kg x $9.800/kg`, y cuenta como un artículo. Excepción existente: el costo del billar se calcula aquí (`hourly_rate × elapsed_minutes / 60`) y podría no coincidir con lo que cobró el backend (que usa su propio reloj); ver "Pendientes".
- **Nunca metas datos de la petición en un comando del sistema.** `printer-queue.helper` y `validate-printer` arman comandos de PowerShell con el nombre de la impresora, que hoy sale **solo** de `PRINTER_NAME` (`.env`). Si algún día el nombre viniera del body, primero hay que validarlo o escaparlo.
- **El papel se define en `config/paper-sizes.js`:** cada perfil declara `columns` (fuente A) y los anchos de la tabla de productos, que deben sumar `columns` (`getPaperSize` lo valida). Un tamaño nuevo = un perfil + `PAPER_SIZE`.
- Textos del ticket y mensajes de error en **español** (`es-CO` para fechas y montos).

## Tests (misma estructura que `pensilpos-backend`)

- **Unitarios** (`tests/`, espejo de `src/`, `*.test.js`): cada módulo aislado con sus dependencias mockeadas. `jest.config.js` excluye de la cobertura `src/app.js` y `src/routes/**` (las rutas se prueban en integración).
- **Integración** (`tests-integration/`, `*.integration.test.js`): peticiones HTTP con supertest contra la app de Express real (`helpers/build-test-app.js`). Solo se reemplaza la frontera externa: la impresora física (`helpers/fake-receipt-printer.js`) y la limpieza de la cola de Windows. `setup-env.js` fija `NODE_ENV`, `PRINTER_NAME` y `PAPER_SIZE` para que un `.env` local no cambie los resultados. Corren en serie (`maxWorkers: 1`).
- **TDD para funcionalidad nueva** (regla de todo Pensil.Pos): primero el test que falla (rojo), luego el código mínimo (verde), luego limpiar (refactor). En refactors puros, un test que fije el comportamiento actual antes de tocar el código.
- No hay umbral de cobertura configurado: la cobertura no debe bajar con un cambio (compara `npm run test:coverage` antes y después).

## Definición de terminado

1. Cada comportamiento nuevo tiene su test escrito antes que el código (unitario y, si toca una ruta o la cadena de middlewares, de integración).
2. `npm test` y `npm run test:integration` pasan, y la cobertura no baja (`/verificar` corre todo y da la tabla).
3. El subagente `code-reviewer` revisó los archivos cambiados y no quedan hallazgos altos ni medios.
4. Si cambió el contrato con el frontend, `thermal-printer.service.ts` de `pensilpos-frontend` cambia en el mismo trabajo (con su TDD) y el README queda al día (endpoints, variables de `.env`).
5. Lo que no se pudo probar sin una impresora real queda dicho explícitamente en el resumen (por ejemplo, cómo se ve el ticket impreso).

## Repos hermanos

- `pensilpos-frontend` — la web que llama a este servicio (Angular; ver `thermal-printer.service.ts`).
- `pensilpos-backend` — fuente de verdad del negocio (ventas, precios, billar, `ticket_print_method`); sus specs en `.github/specs/` (SPEC-051 venta por peso).
- `pensilpos-app` — la app móvil; no usa este servicio.
- `pensilpos-e2e-tests` — los E2E nunca imprimen (no pulsan "Imprimir").

## Pendientes / conocidos

- **`package-lock.json` está en `.gitignore`:** cada `npm install` puede traer versiones distintas de las dependencias (incluidas las nativas, `canvas` y la impresora). Versionarlo es una decisión del equipo; no lo cambies sin pedirlo.
- **Costo del billar recalculado aquí** (ver "Arquitectura"): si el ticket debe mostrar exactamente lo cobrado, el frontend tendría que enviar el monto y este servicio imprimirlo.
- `isPrinterOnline` en `validate-printer.js` siempre devuelve `true` (TODO): Windows reporta estados transitorios que daban falsos negativos.
- SonarQube local (`npm run sonar`) depende de un servidor que el equipo ya no levanta (el backend lo retiró el 2026-10-20).
