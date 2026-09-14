# Product Search Engine

100% local sample application of an e-commerce search engine with asynchronous catalog
ingestion.

- **Public part**: the home page is the search engine. No login required, it queries a REST
  endpoint that hits OpenSearch and shows the catalog with facets, sorting and pagination; as
  you type, results update in the same view.
- **Private part** (JWT login): editable profile and CSV upload. The file is saved to disk, a
  message is published to RabbitMQ, and an **independent worker** parses and indexes it,
  updating the job status in Postgres.

## Getting started

```bash
make install      # backend and frontend dependencies
make up           # postgres + rabbitmq + opensearch (waits until healthy)
make db-migrate   # Postgres schema
make db-seed      # demo user
make os-init      # products index in OpenSearch
make dev          # API :4000 + worker + frontend :5173
```

Open <http://localhost:5173> and log in with **demo@search.local** / **Demo1234!**.

There are two sample files to try out ingestion:
`backend/samples/products.csv` (120 valid products) and
`backend/samples/products-con-errores.csv` (5 valid + 3 invalid rows).

`make help` lists the rest of the shortcuts (`down`, `reset`, `test`, `lint`, `build`, `tools`).

## Ports

| Service | Port | Notes |
|---|---|---|
| Frontend (Vite) | 5173 | proxies `/api` to the API |
| API | 4000 | Express |
| Postgres | 5434 | `search` / `search` / db `search` |
| RabbitMQ | 5672 | dashboard at <http://localhost:15672> (guest/guest) |
| OpenSearch | 9200 | security disabled, single node |
| OpenSearch Dashboards | 5601 | optional: `make tools` |

> Postgres uses 5434 because 5432 and 5433 are usually taken by other projects on the machine.

## Architecture

```
backend/src/
├─ core/              pure domain: entities, use cases and ports (interfaces)
├─ infrastructure/    adapters: Prisma, OpenSearch, RabbitMQ, disk, bcrypt, JWT
├─ http/              Express: routes, thin controllers and middleware
├─ worker/            queue consumer entrypoint
└─ container.ts       composition root: the only place that picks implementations
```

`core` imports nothing from `infrastructure` or `http`: use cases depend only on interfaces,
which makes them testable with doubles and lets the search engine or queue be swapped without
touching business logic.

### Import flow

```
POST /api/uploads/csv  ──► saves the file + PENDING job ──► publishes to RabbitMQ ──► 202
                                                                      │
worker  ◄─────────────────────────────────────────────────────────────┘
  streams the CSV parse ──► bulk index in OpenSearch (_id = sku) ──► job COMPLETED
```

Indexing is idempotent (the document's `_id` is the `sku`): re-uploading the same catalog
updates the products instead of duplicating them. An unreadable message ends up in the
`products.csv.import.dlq` dead-letter queue instead of bouncing indefinitely.

## API

| Method | Route | Auth |
|---|---|---|
| POST | `/api/auth/register` | — |
| POST | `/api/auth/login` | — |
| GET | `/api/auth/me` | JWT |
| GET/PATCH | `/api/profile` | JWT |
| PATCH | `/api/profile/password` | JWT |
| **GET** | **`/api/search`** | **public** |
| GET | `/api/search/suggest` | public |
| POST | `/api/uploads/csv` | JWT |
| GET | `/api/uploads`, `/api/uploads/:id` | JWT |
| GET | `/health` | — |

`/api/search` parameters: `q`, `brand` (repeatable), `category` (repeatable), `minPrice`,
`maxPrice`, `minRating`, `inStock`, `sort` (`relevance` \| `price_asc` \| `price_desc` \|
`rating_desc`), `page`, `size`.

### How text search works

Search runs in **two phases**, orchestrated by the `SearchProducts` use case:

1. **Precise.** Two clauses compete: `best_fields` with the text as typed (boost 5) and, from
   3 letters on, `phrase_prefix` for partial words (boost 3). `tec` → *Teclado* (Keyboard).
2. **Typo-tolerant.** Only if the first phase returned **zero** results, it retries adding
   `best_fields` with `fuzziness: AUTO:4,7` (boost 1). `camra` → *Cámara* (Camera).

Correcting typos always polluted searches that already worked: `camara` returned 15 products,
9 of which had nothing to do with it, `zapa` surfaced *Zara* (one edit away) before
*Zapatillas* (Sneakers), and facet counts came out skewed. By splitting it into two phases, any
search that finds something returns only real matches.

Prefix and typo-tolerance are not interchangeable: `teclao` is one edit away from `teclado`,
but `tec` is four edits away, so no reasonable fuzziness reaches it. `AUTO:4,7` also doesn't
correct below 4 letters; with the default `AUTO`, `tro` allows one edit and pulls in every
*Pro* in the catalog. The prefix clause doesn't look at `description` (too much noise) or
`tags` (it's a `keyword` field, and `phrase_prefix` only works on `text` fields).

When results come from the second phase, the response flags it with `typoTolerant: true` and
the UI shows a notice: *"No exact matches for X. Here's the closest we found."* Below 3
letters it doesn't say "no results": it asks you to keep typing.

## CSV format

```csv
sku,name,description,brand,category,price,currency,stock,rating,imageUrl,tags
SKU-0001,Sony Headphones,Noise cancelling,Sony,Audio,199.99,EUR,42,4.5,https://…,audio|bluetooth
```

The sample catalog's images come from [loremflickr](https://loremflickr.com), which serves
Flickr photos by tag. Every tag and every `lock` (which pins down which specific photo comes
back) were checked by hand: generic tags surface false friends — `speaker` returns public
speakers, `charger` returns Dodge Chargers, and `fan` returns sports fans — and a `lock`
outside that tag's photo set returns an unrelated filler image.

Only `sku`, `name` and `price` are required; everything else has a default value. Decimal
commas, empty cells, a BOM and mixed line endings are all accepted. Invalid rows don't abort
the import: they're counted and shown in the jobs table.

## Tests

### Unit and integration (Vitest)

```bash
make test     # 102 backend tests + 36 frontend tests
make lint     # backend typecheck + frontend eslint
```

These don't need the infrastructure running. The backend tests the use cases against fake
ports, the OpenSearch query builder, the CSV parser, the JWT/bcrypt/disk adapters, and the HTTP
routes with `supertest` and in-memory repositories. The frontend tests the API client with a
mocked `fetch`, the theme hook, and the components with Testing Library.

### End to end (Cypress)

These walk through the real application against the full stack, so it needs to be running:

```bash
make up && make dev     # in one terminal
make e2e                # in another (or `make e2e-open` for interactive mode)
```

| Spec | What it covers |
|---|---|
| `search.cy.ts` | home page, in-place search, prefixes, facets, sorting, accents, shareable URL, empty state |
| `auth.cy.ts` | login, registration, protected routes, persistence and logout |
| `profile.cy.ts` | profile editing and password change |
| `upload.cy.ts` | full ingestion: upload → RabbitMQ → worker → searchable product |
| `theme.cy.ts` | light/dark theme, persistence and no flash |

The search specs seed their own catalog (`sku` prefixed `E2E-`, brand `Zephyra`) directly into
the index and delete it when done, so counts don't depend on whatever else is indexed.
`upload.cy.ts` doesn't seed anything: it's the proof that the full async chain works.
Registration tests create users with a unique email in the local database; `make reset` cleans
them up.

## Note on `npm audit`

The backend carries 4 *high* advisories coming from the Prisma 7 CLI (`mysql2`,
`deepmerge-ts`). They're dev dependencies, they don't reach the runtime, and there's no fixed
version without downgrading Prisma's major version.
