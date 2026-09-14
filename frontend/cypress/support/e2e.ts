import './commands';

// El frontend no captura errores de recursos externos: las imagenes de
// picsum.photos pueden fallar sin que eso invalide la prueba.
Cypress.on('uncaught:exception', (error) => !/Failed to fetch|Load failed/.test(error.message));
