import { e2eProducts, E2E_SKU_PREFIX, type E2eProduct } from './products';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /** Inicia sesion por API y deja el token donde lo busca la aplicacion. */
      login(email?: string, password?: string): Chainable<string>;
      /** Indexa el catalogo de pruebas directamente en OpenSearch. */
      seedE2eProducts(products?: E2eProduct[]): Chainable<void>;
      /** Borra del indice todo lo que hayan dejado las pruebas. */
      cleanE2eProducts(): Chainable<void>;
      /** Escribe una consulta en el buscador de la pagina principal. */
      searchFor(term: string): Chainable<void>;
    }
  }
}

const TOKEN_KEY = 'search.token';

Cypress.Commands.add('login', (email?: string, password?: string) => {
  const user = email ?? (Cypress.env('demoEmail') as string);
  const secret = password ?? (Cypress.env('demoPassword') as string);

  return cy
    .request('POST', `${Cypress.env('apiUrl')}/api/auth/login`, { email: user, password: secret })
    .then((response) => {
      const token = response.body.token as string;
      window.localStorage.setItem(TOKEN_KEY, token);
      return cy.wrap(token, { log: false });
    });
});

Cypress.Commands.add('seedE2eProducts', (products = e2eProducts) => {
  const index = Cypress.env('productsIndex') as string;
  const indexedAt = new Date().toISOString();

  // El _id es el sku, asi que sembrar dos veces actualiza en lugar de duplicar.
  const body =
    products
      .flatMap((product) => [
        JSON.stringify({ index: { _index: index, _id: product.sku } }),
        JSON.stringify({ ...product, indexedAt }),
      ])
      .join('\n') + '\n';

  cy.request({
    method: 'POST',
    url: `${Cypress.env('opensearchUrl')}/_bulk`,
    headers: { 'content-type': 'application/x-ndjson' },
    body,
  })
    .its('body.errors')
    .should('eq', false);

  cy.request('POST', `${Cypress.env('opensearchUrl')}/${index}/_refresh`);
});

Cypress.Commands.add('cleanE2eProducts', () => {
  const index = Cypress.env('productsIndex') as string;

  cy.request({
    method: 'POST',
    url: `${Cypress.env('opensearchUrl')}/${index}/_delete_by_query?refresh=true`,
    body: { query: { prefix: { sku: E2E_SKU_PREFIX } } },
    failOnStatusCode: false,
  });
});

Cypress.Commands.add('searchFor', (term: string) => {
  cy.get('input[type="search"]').clear().type(term);
});

export {};
