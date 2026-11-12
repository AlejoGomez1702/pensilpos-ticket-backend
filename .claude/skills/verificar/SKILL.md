---
description: 'Verifica que el servicio de tickets esté sano: tests unitarios y de integración con cobertura. Úsalo antes de dar por terminado un cambio.'
disable-model-invocation: true
---

# Verificar el servicio de tickets

Responde en español sencillo, con frases cortas.

## Pasos

1. Ejecuta las dos suites con cobertura, desde la raíz del proyecto, aunque la primera falle:
   - `npm run test:coverage` — unitarios (`tests/`).
   - `npm run test:integration:coverage` — integración con supertest y la impresora falsa (`tests-integration/`).
2. Si el usuario dio la cobertura de antes del cambio, compárala: no debe bajar.
3. No modifiques archivos ni intentes arreglar nada. Nunca ejecutes `node node-service.js` ni comandos de PowerShell sobre impresoras reales.

## Formato de la respuesta

| Verificación | Resultado | Detalle                            |
| ------------ | --------- | ---------------------------------- |
| Unitarios    | ✅ / ❌   | N pasan, M fallan · cobertura X %  |
| Integración  | ✅ / ❌   | N pasan, M fallan · cobertura X %  |

Si algo falla, explica debajo de la tabla, para cada fallo: **qué falló** (archivo y test), **por qué** (causa probable) y **cómo arreglarlo** (paso concreto).

Termina recordando lo que solo se comprueba con una impresora real (cómo se ve el ticket impreso), si el cambio tocó el formato del ticket. Si todo pasa, dilo en una línea.
