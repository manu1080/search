import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    video: false,
    screenshotOnRunFailure: true,
    screenshotsFolder: 'cypress/screenshots',
    viewportWidth: 1400,
    viewportHeight: 900,
    // La importacion de un CSV pasa por RabbitMQ y el worker: hay que dar
    // margen a que el trabajo termine antes de comprobar el resultado.
    defaultCommandTimeout: 8000,
    retries: { runMode: 2, openMode: 0 },
    env: {
      apiUrl: 'http://localhost:4000',
      opensearchUrl: 'http://localhost:9200',
      productsIndex: 'products',
      demoEmail: 'demo@search.local',
      demoPassword: 'Demo1234!',
    },
  },
});
