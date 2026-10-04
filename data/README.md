# Feriados de respaldo

`feriados-2026.json` y `feriados-2027.json` son copias de la respuesta de
`https://api.argentinadatos.com/v1/feriados/{año}` (mismo formato: `fecha`, `tipo`, `nombre`).
La app usa la API en vivo y cae a estos archivos solo si la API falla
(`src/app/api/holidays/route.ts`). En ambos caminos los datos pasan por
`normalizeHolidays` (`src/lib/domain/holidays.ts`), que descarta los `puente`
(días no laborables, no feriados) y aplica el traslado de la Ley 27.399.

## Verificación

- **2026** — contrastado el 04/10/2026 contra el calendario oficial
  (<https://www.argentina.gob.ar/jefatura/feriados-nacionales-2026>, datos en
  `/sites/default/files/holidays-2026-es.json`). Coinciden los 17 feriados nacionales.
  - **09/11/2026 "Visita del papa León XIV"**: figura en el calendario oficial como
    *feriado inamovible* nacional (Decreto 1103/2026, Boletín Oficial del 28/09/2026). Se incluye.
    Los días 10/11 y 11/11 son feriados locales (CABA y Córdoba; provincia de Buenos Aires): la API
    no los trae y no se incluyen.
  - Los `puente` (23/03, 10/07 y 07/12) y los días no laborables religiosos quedan afuera.
- **2027** — **provisorio**: el calendario oficial de 2027 todavía no está publicado. La API lista los
  feriados trasladables en su fecha original (17/06, 17/08, 12/10, 20/11); `normalizeHolidays` los mueve
  según la Ley 27.399 (martes y miércoles → lunes anterior; jueves y viernes → lunes siguiente).
  Hay que volver a verificarlo cuando el Gobierno publique el calendario (suele ser a fin de año).

Para actualizar un año: `curl https://api.argentinadatos.com/v1/feriados/2028 > data/feriados-2028.json`,
contrastar con argentina.gob.ar y sumarlo a `BACKUPS` en `src/app/api/holidays/route.ts`.
