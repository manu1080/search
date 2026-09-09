import { E2E_BRAND, E2E_COUNTS, E2E_TERM } from '../support/products';

/**
 * Busqueda publica. El catalogo de pruebas se siembra directamente en el indice
 * para que los recuentos sean deterministas; la ingesta real por la cola se
 * comprueba en upload.cy.ts.
 */
describe('Busqueda publica', () => {
  /**
   * Comprueba el resultado por el numero de fichas pintadas y no por la
   * visibilidad del contador: al hacer clic en una faceta, Cypress desplaza la
   * columna de resultados y el contador puede quedar fuera del area visible.
   */
  function esperarResultados(total: number) {
    cy.contains(`${total} producto`).should('exist');
    cy.get('[data-slot="card"]').should('have.length', total);
  }

  before(() => {
    cy.seedE2eProducts();
  });

  after(() => {
    cy.cleanE2eProducts();
  });

  beforeEach(() => {
    cy.visit('/');
  });

  it('se puede buscar sin haber iniciado sesion', () => {
    cy.contains('Búsqueda abierta').should('be.visible');
    cy.contains('button', 'Entrar').should('be.visible');

    cy.searchFor(E2E_TERM);

    esperarResultados(E2E_COUNTS.total);
  });

  it('muestra los datos del producto y resalta lo buscado', () => {
    cy.searchFor(E2E_TERM);

    cy.contains('Trombolino Uno')
      .closest('[data-slot="card"]')
      .within(() => {
        cy.get('mark').should('contain.text', E2E_TERM);
        // La marca se ve en mayusculas por CSS, pero en el DOM va tal cual.
        cy.contains(E2E_BRAND).should('exist');
        cy.contains('10,00').should('exist');
        cy.contains('4.1').should('exist');
      });
  });

  it('marca como agotados los productos sin stock', () => {
    cy.searchFor(E2E_TERM);

    cy.contains('Trombolino Dos')
      .closest('[data-slot="card"]')
      .within(() => {
        cy.contains('Agotado').should('exist');
      });
  });

  it('filtra por categoria desde las facetas', () => {
    cy.searchFor(E2E_TERM);
    esperarResultados(E2E_COUNTS.total);

    cy.contains('button', 'Laboratorio').click();

    esperarResultados(E2E_COUNTS.laboratorio);
    cy.contains('Trombolino Cinco').should('not.exist');
  });

  it('acumula filtros de marca y categoria', () => {
    cy.searchFor(E2E_TERM);
    esperarResultados(E2E_COUNTS.total);

    cy.contains('button', 'Taller').click();
    cy.contains('button', E2E_BRAND).click();

    esperarResultados(E2E_COUNTS.taller);
  });

  it('deja quitar todos los filtros de golpe', () => {
    cy.searchFor(E2E_TERM);
    cy.contains('button', 'Laboratorio').click();
    esperarResultados(E2E_COUNTS.laboratorio);

    cy.contains('button', 'Limpiar').click();

    esperarResultados(E2E_COUNTS.total);
  });

  it('filtra por disponibilidad con el interruptor de stock', () => {
    cy.searchFor(E2E_TERM);
    esperarResultados(E2E_COUNTS.total);

    cy.contains('Solo con stock').click();

    esperarResultados(E2E_COUNTS.conStock);
  });

  it('ordena por precio ascendente', () => {
    cy.searchFor(E2E_TERM);
    esperarResultados(E2E_COUNTS.total);

    cy.get('button').contains('Relevancia').click();
    cy.contains('[role="option"], li', 'Precio: menor a mayor').click();

    cy.get('[data-slot="card"]').first().should('contain.text', 'Trombolino Uno');
  });

  it('ordena por precio descendente', () => {
    cy.searchFor(E2E_TERM);
    esperarResultados(E2E_COUNTS.total);

    cy.get('button').contains('Relevancia').click();
    cy.contains('[role="option"], li', 'Precio: mayor a menor').click();

    cy.get('[data-slot="card"]').first().should('contain.text', 'Trombolino Seis');
  });

  it('encuentra igual con acentos y sin ellos', () => {
    // "Zephyra" solo existe en el catalogo de pruebas, asi que el recuento no
    // depende de lo que haya indexado el catalogo de demostracion.
    cy.searchFor('zephyra');
    esperarResultados(E2E_COUNTS.total);

    cy.get('input[type="search"]').clear().type('zéphyra');
    esperarResultados(E2E_COUNTS.total);
  });

  it('avisa cuando no hay resultados y permite reiniciar', () => {
    cy.searchFor('zzzzznoexisteesteproducto');

    cy.contains('Sin resultados').should('be.visible');
    cy.contains('button', 'Limpiar filtros').should('be.visible');
  });

  it('lleva la consulta en la URL para poder compartirla', () => {
    cy.searchFor(E2E_TERM);

    cy.url().should('include', `q=${E2E_TERM}`);

    cy.visit(`/?q=${E2E_TERM}`);
    cy.get('input[type="search"]').should('have.value', E2E_TERM);
    esperarResultados(E2E_COUNTS.total);
  });

  it('Escape vacia el buscador y, con el vacio, cierra la capa', () => {
    cy.searchFor(E2E_TERM);
    cy.get('[role="dialog"]').should('be.visible');

    // El campo de react-aria consume la primera pulsacion para vaciarse.
    cy.get('input[type="search"]').type('{esc}');
    cy.get('input[type="search"]').should('have.value', '');
    cy.get('[role="dialog"]').should('be.visible');

    cy.get('input[type="search"]').type('{esc}');
    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('Encuentra cualquier producto').should('be.visible');
  });

  it('Escape cierra la capa directamente desde fuera del buscador', () => {
    cy.searchFor(E2E_TERM);
    esperarResultados(E2E_COUNTS.total);

    cy.contains('button', 'Laboratorio').click().type('{esc}');

    cy.get('[role="dialog"]').should('not.exist');
  });

  it('cierra la capa con el boton Cerrar', () => {
    cy.searchFor(E2E_TERM);

    cy.contains('button', 'Cerrar').click();

    cy.get('[role="dialog"]').should('not.exist');
    cy.url().should('not.include', 'q=');
  });

  it('busca desde los terminos sugeridos de la portada', () => {
    cy.contains('button', 'Cafetera').click();

    cy.get('[role="dialog"]').should('be.visible');
    cy.get('input[type="search"]').should('have.value', 'Cafetera');
  });
});
