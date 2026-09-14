/**
 * Tema claro/oscuro: se aplica, se recuerda y no parpadea al recargar.
 *
 * El tema inicial depende del `prefers-color-scheme` del navegador que ejecute
 * la bateria, asi que cada prueba fija el punto de partida en localStorage en
 * lugar de dar por hecho uno concreto.
 */
describe('Tema claro y oscuro', () => {
  function visitarCon(tema: 'light' | 'dark' | null) {
    cy.visit('/', {
      onBeforeLoad: (win) => {
        win.localStorage.clear();
        if (tema) win.localStorage.setItem('theme', tema);
      },
    });
  }

  it('respeta el tema claro guardado', () => {
    visitarCon('light');

    cy.get('html').should('not.have.class', 'dark');
    cy.get('html').should('have.attr', 'data-theme', 'light');
  });

  it('respeta el tema oscuro guardado', () => {
    visitarCon('dark');

    cy.get('html').should('have.class', 'dark');
    cy.get('html').should('have.attr', 'data-theme', 'dark');
  });

  it('sigue la preferencia del sistema cuando no hay nada guardado', () => {
    visitarCon(null);

    cy.window().then((win) => {
      const prefiereOscuro = win.matchMedia('(prefers-color-scheme: dark)').matches;
      cy.get('html').should(prefiereOscuro ? 'have.class' : 'not.have.class', 'dark');
    });
  });

  it('el interruptor alterna el tema y lo guarda', () => {
    visitarCon('light');

    cy.get('button[aria-label*="tema"]').click();
    cy.get('html').should('have.class', 'dark');
    cy.window().its('localStorage.theme').should('eq', 'dark');

    cy.get('button[aria-label*="tema"]').click();
    cy.get('html').should('not.have.class', 'dark');
    cy.window().its('localStorage.theme').should('eq', 'light');
  });

  it('recuerda el tema al recargar', () => {
    visitarCon('light');
    cy.get('button[aria-label*="tema"]').click();
    cy.get('html').should('have.class', 'dark');

    cy.reload();

    cy.get('html').should('have.class', 'dark');
  });

  it('aplica el tema antes de pintar, sin parpadeo', () => {
    // El script en linea de index.html debe dejar la clase puesta ya en la
    // primera carga del documento, antes de que arranque React.
    cy.visit('/', {
      onBeforeLoad: (win) => win.localStorage.setItem('theme', 'dark'),
      onLoad: (win) => {
        expect(win.document.documentElement.classList.contains('dark')).to.equal(true);
      },
    });
  });

  it('mantiene el tema mientras se busca', () => {
    visitarCon('dark');

    cy.get('input[type="search"]').type('tec');

    cy.get('html').should('have.class', 'dark');
  });
});
