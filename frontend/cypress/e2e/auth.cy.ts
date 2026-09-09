/** Login, registro y proteccion de rutas. */
describe('Autenticacion', () => {
  const demoEmail = Cypress.env('demoEmail') as string;
  const demoPassword = Cypress.env('demoPassword') as string;

  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('redirige al login al entrar en una ruta privada', () => {
    cy.visit('/perfil');

    cy.url().should('include', '/login');
    cy.contains('Iniciar sesión').should('be.visible');
  });

  it('rechaza credenciales incorrectas sin dejar entrar', () => {
    cy.visit('/login');

    cy.get('input[type="email"]').clear().type(demoEmail);
    cy.get('input[type="password"]').type('contraseña-incorrecta');
    cy.get('form').submit();

    cy.contains('Email o contraseña incorrectos').should('be.visible');
    cy.url().should('include', '/login');
  });

  it('entra con el usuario de demostracion y muestra el perfil', () => {
    cy.visit('/login');

    cy.get('input[type="email"]').clear().type(demoEmail);
    cy.get('input[type="password"]').type(demoPassword);
    cy.get('form').submit();

    cy.url().should('include', '/perfil');
    cy.contains('Usuario Demo').should('be.visible');
    cy.contains('a', 'Subir CSV').should('be.visible');
  });

  it('vuelve al destino que se pidio antes de iniciar sesion', () => {
    cy.visit('/subir');
    cy.url().should('include', '/login');

    cy.get('input[type="email"]').clear().type(demoEmail);
    cy.get('input[type="password"]').type(demoPassword);
    cy.get('form').submit();

    cy.url().should('include', '/subir');
  });

  it('mantiene la sesion al recargar la pagina', () => {
    cy.login();
    cy.visit('/perfil');
    cy.contains('Usuario Demo').should('be.visible');

    cy.reload();

    cy.contains('Usuario Demo').should('be.visible');
  });

  it('cierra sesion y deja de mostrar las rutas privadas', () => {
    cy.login();
    cy.visit('/perfil');

    cy.contains('button', 'Salir').click();

    cy.contains('a', 'Subir CSV').should('not.exist');
    cy.visit('/perfil');
    cy.url().should('include', '/login');
  });

  it('descarta un token invalido en lugar de quedarse cargando', () => {
    cy.visit('/', {
      onBeforeLoad: (win) => win.localStorage.setItem('search.token', 'token-falso'),
    });

    cy.visit('/perfil');

    cy.url().should('include', '/login');
  });

  it('valida la contraseña en el registro antes de llamar al servidor', () => {
    cy.visit('/registro');

    cy.get('input[type="text"]').first().type('Persona Nueva');
    cy.get('input[type="email"]').type(`nuevo-${Date.now()}@example.com`);
    cy.get('input[type="password"]').type('corta');
    cy.get('form').submit();

    cy.contains('al menos 8 caracteres').should('be.visible');
  });

  it('no deja registrar un email que ya existe', () => {
    cy.visit('/registro');

    cy.get('input[type="text"]').first().type('Duplicado');
    cy.get('input[type="email"]').type(demoEmail);
    cy.get('input[type="password"]').type('unaclavevalida');
    cy.get('form').submit();

    cy.contains('Ya existe una cuenta con ese email').should('be.visible');
  });

  it('registra una cuenta nueva y entra directamente', () => {
    const email = `e2e-${Date.now()}@example.com`;

    cy.visit('/registro');
    cy.get('input[type="text"]').first().type('Persona E2E');
    cy.get('input[type="email"]').type(email);
    cy.get('input[type="password"]').type('unaclavevalida');
    cy.get('form').submit();

    cy.url().should('include', '/perfil');
    cy.contains('Persona E2E').should('be.visible');
    cy.contains(email).should('be.visible');
  });
});
