import { buildContainer } from '../container.js';
import { disconnectPrisma } from '../infrastructure/db/prisma.js';
import { closeOpensearch } from '../infrastructure/opensearch/client.js';

/**
 * Worker: proceso independiente de la API. Consume los mensajes de importación
 * y delega toda la logica en el caso de uso ProcessUploadJob.
 */
const container = buildContainer('worker');

async function main(): Promise<void> {
  await container.productIndex.ensureIndex();

  await container.consumer().start(async ({ jobId }) => {
    container.logger.info({ jobId }, 'Procesando importación CSV');
    const job = await container.useCases.processUploadJob.execute(jobId);
    container.logger.info(
      { jobId, status: job.status, rowsIndexed: job.rowsIndexed, rowsFailed: job.rowsFailed },
      'Importación terminada',
    );
  });
}

async function shutdown(signal: string): Promise<void> {
  container.logger.info({ signal }, 'Cerrando worker');
  await Promise.allSettled([container.rabbit.close(), disconnectPrisma(), closeOpensearch()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

main().catch((error) => {
  container.logger.error({ err: error }, 'El worker no pudo arrancar');
  process.exit(1);
});
