/** Perfil: edicion de datos y cambio de contraseña. */
describe('Perfil', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/perfil');
  });

  it('muestra los datos actuales del usuario', () => {
    cy.contains('Usuario Demo').should('be.visible');
    cy.contains(Cypress.env('demoEmail') as string).should('be.visible');
    cy.contains('Mis datos').should('be.visible');
  });

  it('guarda la bio y la conserva tras recargar', () => {
    const bio = `Bio de prueba ${Date.now()}`;

    cy.get('textarea').clear().type(bio);
    cy.contains('button', 'Guardar cambios').click();

    cy.contains('Perfil actualizado').should('be.visible');

    cy.reload();
    cy.get('textarea').should('have.value', bio);
  });

  it('no guarda una URL de avatar que no es valida', () => {
    cy.get('input[type="url"]').clear().type('esto-no-es-una-url');
    cy.contains('button', 'Guardar cambios').click();

    // El campo es type="url": el navegador corta el envio antes de llamar a la
    // API. El rechazo en servidor se cubre en los tests HTTP del backend.
    cy.get('input[type="url"]').then(([input]) => {
      expect((input as HTMLInputElement).checkValidity()).to.equal(false);
    });
    cy.contains('Perfil actualizado').should('not.exist');
  });

  it('deja vaciar la bio', () => {
    cy.get('textarea').clear().type('algo');
    cy.contains('button', 'Guardar cambios').click();
    cy.contains('Perfil actualizado').should('be.visible');

    cy.get('textarea').clear();
    cy.contains('button', 'Guardar cambios').click();
    cy.contains('Perfil actualizado').should('be.visible');

    cy.reload();
    cy.get('textarea').should('have.value', '');
  });

  it('actualiza el nombre y lo refleja en la barra superior', () => {
    cy.get('input[type="text"]').first().clear().type('Demo Renombrado');
    cy.contains('button', 'Guardar cambios').click();
    cy.contains('Perfil actualizado').should('be.visible');

    cy.contains('Demo Renombrado').should('be.visible');

    // Se deja el nombre original para no afectar al resto de la bateria.
    cy.get('input[type="text"]').first().clear().type('Usuario Demo');
    cy.contains('button', 'Guardar cambios').click();
    cy.contains('Perfil actualizado').should('be.visible');
  });

  it('exige la contraseña actual correcta para cambiarla', () => {
    cy.get('input[type="password"]').first().type('no-es-la-actual');
    cy.get('input[type="password"]').last().type('otraclavevalida');
    cy.contains('button', 'Cambiar contraseña').click();

    cy.contains('La contraseña actual no es correcta').should('be.visible');
  });

  it('valida en cliente que la nueva contraseña sea suficientemente larga', () => {
    cy.get('input[type="password"]').first().type(Cypress.env('demoPassword') as string);
    cy.get('input[type="password"]').last().type('corta');
    cy.contains('button', 'Cambiar contraseña').click();

    cy.contains('necesita 8 caracteres').should('be.visible');
  });
});
