---
description: 'Trabaja un cambio del servicio de tickets de punta a punta: entiende qué debe verse en el ticket, revisa el contrato con el frontend, lo implementa con TDD y lo verifica. Úsalo cuando pidan algo nuevo en el ticket o en el servicio de impresión, no para arreglos pequeños.'
argument-hint: '<historia de usuario o cambio en el ticket>'
---

# Trabajar una historia en el servicio de tickets

Historia: $ARGUMENTS

Responde en español sencillo, con frases cortas. Avanza por fases y no saltes ninguna.

## Fase 1 — Entender

1. Lee `CLAUDE.md` y el código que toca: `routes/printer.routes.js`, el middleware de mapeo (`validate-ticket-data.js`), `helpers/ticket-builder.helper.js` y sus tests.
2. Si el ticket necesita un dato nuevo, revisa si el frontend ya lo envía (`pensilpos-frontend/src/app/dashboard/sales/services/thermal-printer.service.ts`) y si el backend lo tiene (`pensilpos-backend`, su spec en `.github/specs/`). Este servicio no inventa datos ni reglas: si el dato no existe, dilo.
3. Si la historia es grande (cambia el contrato o toca varios repos), propón primero dónde va la spec: en el repo dueño del cambio (backend o frontend).

## Fase 2 — Proponer

Muestra un resumen corto: qué se verá en el ticket (un ejemplo de las líneas impresas), qué campos cambian en el contrato, qué archivos se tocan y qué tests se escribirán. **Espera la aprobación** antes de escribir código. En GitHub Actions (`GITHUB_ACTIONS=true`), si el pedido no dice explícitamente que se implemente, entrega solo la propuesta.

## Fase 3 — Implementar con TDD

1. **Rojo:** el test unitario del comportamiento (por ejemplo, en `tests/helpers/ticket-builder.helper.test.js`) y, si cambia una ruta o la validación, el de integración en `tests-integration/routes/`. Comprueba que fallan (`npx jest <archivo>`; para integración, `npx jest --config jest.integration.config.js <archivo>`).
2. **Verde:** el código mínimo.
3. **Refactor:** limpia sin tocar los tests.

Respeta las reglas de `CLAUDE.md`: los montos llegan calculados, las líneas por peso van en gramos con precio por kg, una impresión a la vez, nada de la petición en comandos del sistema, el papel por perfil en `paper-sizes.js`, textos en español. Si cambia el contrato, el cambio en `thermal-printer.service.ts` del frontend va en el mismo trabajo, con el TDD de ese repo.

## Fase 4 — Verificar

1. `npm run test:coverage` y `npm run test:integration:coverage` en verde, sin bajar la cobertura.
2. Pide una revisión al subagente `code-reviewer` con la lista de archivos cambiados y corrige los hallazgos altos y medios.
3. Di explícitamente qué falta probar con una impresora real.

## Fase 5 — Cerrar

Actualiza el README si cambiaron endpoints o variables de `.env`, y entrega un resumen: qué cambió, un ejemplo del ticket, archivos, resultado de los tests, cambios en otros repos y lo pendiente con la impresora real.
