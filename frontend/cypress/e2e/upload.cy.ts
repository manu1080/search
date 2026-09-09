import { e2eCsv, e2eProducts, E2E_COUNTS, E2E_TERM } from '../support/products';

/**
 * Recorrido completo de la ingesta: subir un CSV desde la interfaz, esperar a
 * que RabbitMQ y el worker lo procesen y comprobar que los productos aparecen
 * en la busqueda. Aqui no se siembra nada a mano: es la prueba de que toda la
 * cadena funciona.
 */
describe('Importacion de catalogo', () => {
  beforeEach(() => {
    cy.cleanE2eProducts();
    cy.login();
    cy.visit('/subir');
  });

  after(() => {
    cy.cleanE2eProducts();
  });

  function subirCsv(contenido: string, nombre: string) {
    cy.get('input[type="file"]').selectFile(
      { contents: Cypress.Buffer.from(contenido), fileName: nombre, mimeType: 'text/csv' },
      { force: true },
    );
  }

  it('procesa el CSV de punta a punta y lo deja buscable', () => {
    subirCsv(e2eCsv(), 'catalogo-e2e.csv');

    cy.contains('en cola').should('be.visible');

    // El worker consume de RabbitMQ e indexa: la tabla se refresca sola.
    cy.contains('tr', 'catalogo-e2e.csv', { timeout: 40000 })
      .should('contain.text', 'Completado')
      .and('contain.text', `${E2E_COUNTS.total} / ${E2E_COUNTS.total}`);

    cy.visit('/');
    cy.searchFor(E2E_TERM);
    cy.contains(`${E2E_COUNTS.total} productos`).should('be.visible');
  });

  it('cuenta las filas invalidas sin perder las validas', () => {
    const conErrores =
      e2eCsv(e2eProducts.slice(0, 2)) +
      'E2E-9001,,Fila sin nombre,Zephyra,Laboratorio,10,EUR,1,4,,e2e\n' +
      'E2E-9002,Precio roto,desc,Zephyra,Laboratorio,no-es-un-numero,EUR,1,4,,e2e\n';

    subirCsv(conErrores, 'catalogo-con-errores.csv');

    cy.contains('tr', 'catalogo-con-errores.csv', { timeout: 40000 })
      .should('contain.text', 'Completado')
      .and('contain.text', '2 / 4')
      .and('contain.text', '2 con error');

    cy.contains('summary', 'Errores de catalogo-con-errores.csv').click();
    cy.contains('name es obligatorio').should('be.visible');
  });

  it('reprocesar el mismo fichero actualiza en vez de duplicar', () => {
    subirCsv(e2eCsv(), 'catalogo-e2e.csv');
    cy.contains('tr', 'catalogo-e2e.csv', { timeout: 40000 }).should('contain.text', 'Completado');

    subirCsv(e2eCsv(), 'catalogo-e2e.csv');
    cy.get('tr:contains("catalogo-e2e.csv")', { timeout: 40000 }).should('have.length.at.least', 2);

    cy.visit('/');
    cy.searchFor(E2E_TERM);
    cy.contains(`${E2E_COUNTS.total} productos`).should('be.visible');
  });

  it('rechaza un fichero que no es CSV', () => {
    cy.get('input[type="file"]').selectFile(
      {
        contents: Cypress.Buffer.from('{"no":"soy un csv"}'),
        fileName: 'datos.json',
        mimeType: 'application/json',
      },
      { force: true },
    );

    cy.contains('Solo se aceptan ficheros CSV').should('be.visible');
  });

  it('explica el formato del CSV que espera', () => {
    cy.contains('Columnas esperadas').should('be.visible');
    cy.contains('sku,name,description,brand,category,price').should('be.visible');
  });
});
