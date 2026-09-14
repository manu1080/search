# Buscador de productos

Aplicación de ejemplo, 100 % local, de un buscador de e-commerce con ingesta asíncrona de
catálogos.

- **Parte abierta**: la página principal es el buscador. Sin registro, consulta un endpoint
  REST que ataca OpenSearch y muestra el catálogo con facetas, orden y paginación; al escribir,
  los resultados se actualizan en la misma vista.
- **Parte privada** (login JWT): perfil editable y subida de CSV. El fichero se guarda en
  disco, se publica un mensaje en RabbitMQ y un **worker independiente** lo parsea e indexa,
  actualizando el estado del trabajo en Postgres.

## Arranque

```bash
make install      # dependencias de backend y frontend
make up           # postgres + rabbitmq + opensearch (espera a que estén sanos)
make db-migrate   # esquema de Postgres
make db-seed      # usuario demo
make os-init      # índice de productos en OpenSearch
make dev          # API :4000 + worker + frontend :5173
```

Abre <http://localhost:5173> y entra con **demo@search.local** / **Demo1234!**.

Para probar la ingesta hay dos ficheros de ejemplo:
`backend/samples/products.csv` (120 productos válidos) y
`backend/samples/products-con-errores.csv` (5 válidos + 3 filas inválidas).

`make help` lista el resto de atajos (`down`, `reset`, `test`, `lint`, `build`, `tools`).

## Puertos

| Servicio | Puerto | Notas |
|---|---|---|
| Frontend (Vite) | 5173 | proxy de `/api` hacia la API |
| API | 4000 | Express |
| Postgres | 5434 | `search` / `search` / db `search` |
| RabbitMQ | 5672 | panel en <http://localhost:15672> (guest/guest) |
| OpenSearch | 9200 | seguridad desactivada, un solo nodo |
| OpenSearch Dashboards | 5601 | opcional: `make tools` |

> Se usa el 5434 para Postgres porque el 5432 y el 5433 suelen estar ocupados por otros
> proyectos de la máquina.

## Arquitectura

```
backend/src/
├─ core/              dominio puro: entidades, casos de uso y puertos (interfaces)
├─ infrastructure/    adaptadores: Prisma, OpenSearch, RabbitMQ, disco, bcrypt, JWT
├─ http/              Express: rutas, controladores finos y middleware
├─ worker/            entrypoint del consumidor de la cola
└─ container.ts       composition root: único sitio que elige implementaciones
```

`core` no importa nada de `infrastructure` ni de `http`: los casos de uso dependen solo de
interfaces, lo que permite probarlos con dobles y cambiar de motor de búsqueda o de cola sin
tocar la lógica de negocio.

### Flujo de una importación

```
POST /api/uploads/csv  ──► guarda el fichero + job PENDING ──► publica en RabbitMQ ──► 202
                                                                      │
worker  ◄─────────────────────────────────────────────────────────────┘
  parsea el CSV en streaming ──► bulk index en OpenSearch (_id = sku) ──► job COMPLETED
```

La indexación es idempotente (el `_id` del documento es el `sku`): volver a subir el mismo
catálogo actualiza los productos en lugar de duplicarlos. Un mensaje ilegible acaba en la cola
de descarte `products.csv.import.dlq` en vez de rebotar indefinidamente.

## API

| Método | Ruta | Auth |
|---|---|---|
| POST | `/api/auth/register` | — |
| POST | `/api/auth/login` | — |
| GET | `/api/auth/me` | JWT |
| GET/PATCH | `/api/profile` | JWT |
| PATCH | `/api/profile/password` | JWT |
| **GET** | **`/api/search`** | **abierto** |
| GET | `/api/search/suggest` | abierto |
| POST | `/api/uploads/csv` | JWT |
| GET | `/api/uploads`, `/api/uploads/:id` | JWT |
| GET | `/health` | — |

Parámetros de `/api/search`: `q`, `brand` (repetible), `category` (repetible), `minPrice`,
`maxPrice`, `minRating`, `inStock`, `sort` (`relevance` \| `price_asc` \| `price_desc` \|
`rating_desc`), `page`, `size`.

### Cómo se busca el texto

La búsqueda va en **dos fases**, y la orquesta el caso de uso `SearchProducts`:

1. **Precisa.** Compiten dos cláusulas: `best_fields` con lo escrito tal cual (boost 5) y, desde
   3 letras, `phrase_prefix` para palabras a medias (boost 3). `tec` → *Teclado*.
2. **Con erratas.** Solo si la primera no devolvió **ni un** resultado, se repite añadiendo
   `best_fields` con `fuzziness: AUTO:4,7` (boost 1). `camra` → *Cámara*.

Corregir erratas siempre metía ruido en las búsquedas que ya funcionaban: `camara` devolvía 15
productos de los que 9 no tenían nada que ver, `zapa` sacaba *Zara* (a una edición) antes que
*Zapatillas*, y las cuentas de las facetas salían falseadas. Separándolo en dos fases, toda
búsqueda que encuentra algo devuelve solo coincidencias reales.

Prefijo y erratas no se sustituyen: `teclao` está a una edición de `teclado`, pero `tec` está a
cuatro, así que ninguna fuzziness razonable lo alcanza. `AUTO:4,7` además no corrige por debajo
de 4 letras; con el `AUTO` por defecto, `tro` admite una edición y arrastra todos los *Pro* del
catálogo. El prefijo no mira `description` (demasiado ruido) ni `tags` (es `keyword`, y
`phrase_prefix` solo admite campos `text`).

Cuando los resultados vienen de la segunda fase, la respuesta lo marca con `typoTolerant: true`
y la vista avisa: *«No hay coincidencias exactas con X. Esto es lo más parecido.»* Con menos de 3
letras no dice "sin resultados": pide que se siga escribiendo.

## Formato del CSV

```csv
sku,name,description,brand,category,price,currency,stock,rating,imageUrl,tags
SKU-0001,Auriculares Sony,Con cancelación de ruido,Sony,Audio,199.99,EUR,42,4.5,https://…,audio|bluetooth
```

Las imágenes del catálogo de ejemplo vienen de [loremflickr](https://loremflickr.com), que
sirve fotos de Flickr por etiqueta. Cada etiqueta y cada `lock` (que fija qué foto concreta
devuelve) se revisaron a ojo: con etiquetas genéricas salen falsos amigos —`speaker` da
oradores, `charger` da coches Dodge y `fan` da aficionados— y un `lock` fuera del conjunto de
fotos de esa etiqueta devuelve una imagen de relleno sin relación.

Solo `sku`, `name` y `price` son obligatorios; el resto tiene valor por defecto. Se aceptan
precios con coma decimal, celdas vacías, BOM y finales de línea mezclados. Las filas inválidas
no abortan la importación: se cuentan y se muestran en la tabla de trabajos.

## Tests

### Unitarios y de integración (Vitest)

```bash
make test     # 102 tests de backend + 36 de frontend
make lint     # typecheck del backend + eslint del frontend
```

No necesitan que la infraestructura esté levantada. El backend prueba los casos de uso contra
puertos falsos, el constructor de consultas de OpenSearch, el parser de CSV, los adaptadores de
JWT/bcrypt/disco y las rutas HTTP con `supertest` y repositorios en memoria. El frontend prueba
el cliente de la API con `fetch` simulado, el hook de tema y los componentes con Testing Library.

### End to end (Cypress)

Recorren la aplicación real contra el stack completo, así que hay que tenerlo arrancado:

```bash
make up && make dev     # en una terminal
make e2e                # en otra (o `make e2e-open` para el modo interactivo)
```

| Spec | Qué cubre |
|---|---|
| `search.cy.ts` | página principal, búsqueda en la misma vista, prefijos, facetas, orden, acentos, URL compartible, estado vacío |
| `auth.cy.ts` | login, registro, rutas protegidas, persistencia y cierre de sesión |
| `profile.cy.ts` | edición de perfil y cambio de contraseña |
| `upload.cy.ts` | ingesta completa: subida → RabbitMQ → worker → producto buscable |
| `theme.cy.ts` | tema claro/oscuro, persistencia y ausencia de parpadeo |

Las specs de búsqueda siembran su propio catálogo (`sku` con prefijo `E2E-`, marca `Zephyra`)
directamente en el índice y lo borran al terminar, para que los recuentos no dependan de lo que
haya indexado. `upload.cy.ts` no siembra nada: es la prueba de que la cadena asíncrona completa
funciona. Los tests de registro crean usuarios con email único en la base de datos local;
`make reset` los limpia.

## Nota sobre `npm audit`

El backend arrastra 4 avisos *high* que vienen del CLI de Prisma 7 (`mysql2`, `deepmerge-ts`).
Son dependencias de desarrollo, no llegan al runtime, y no hay versión corregida sin bajar de
versión mayor de Prisma.
