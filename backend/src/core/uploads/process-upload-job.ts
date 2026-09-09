import type { ProductIndexRepository } from '../products/product-index-repository.port.js';
import type { Clock } from '../shared/clock.js';
import { NotFoundError } from '../shared/errors.js';
import type { CsvProductParser } from './csv-parser.port.js';
import type { FileStorage } from './file-storage.port.js';
import { MAX_STORED_ROW_ERRORS, type UploadJob, type UploadJobRowError } from './upload-job.js';
import type { UploadJobRepository } from './upload-job-repository.port.js';

export const INDEX_BATCH_SIZE = 500;

/**
 * Nucleo del worker: lee el CSV en lotes, indexa en el motor de búsqueda y deja
 * el job con un resumen fiable de filas leidas / indexadas / descartadas.
 *
 * Es idempotente: los documentos se indexan por sku, así que reprocesar el
 * mismo fichero actualiza en vez de duplicar.
 */
export class ProcessUploadJob {
  constructor(
    private readonly jobs: UploadJobRepository,
    private readonly storage: FileStorage,
    private readonly parser: CsvProductParser,
    private readonly index: ProductIndexRepository,
    private readonly clock: Clock,
  ) {}

  async execute(jobId: string): Promise<UploadJob> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundError('Job');

    if (job.status === 'COMPLETED') return job;

    await this.jobs.update(job.id, { status: 'PROCESSING', startedAt: this.clock.now() });

    let rowsTotal = 0;
    let rowsIndexed = 0;
    let rowsFailed = 0;
    const errors: UploadJobRowError[] = [];

    const collect = (rowErrors: UploadJobRowError[]) => {
      rowsFailed += rowErrors.length;
      for (const rowError of rowErrors) {
        if (errors.length < MAX_STORED_ROW_ERRORS) errors.push(rowError);
      }
    };

    try {
      await this.index.ensureIndex();

      const stream = this.storage.openRead(job.storedPath);
      for await (const batch of this.parser.parse(stream, INDEX_BATCH_SIZE)) {
        rowsTotal += batch.rowsRead;
        collect(batch.errors);

        if (batch.products.length > 0) {
          const result = await this.index.bulkIndex(batch.products);
          rowsIndexed += result.indexed;
          collect(result.errors.map((message) => ({ line: 0, message })));
        }

        await this.jobs.update(job.id, { rowsTotal, rowsIndexed, rowsFailed, errors });
      }

      await this.index.refresh();

      return await this.jobs.update(job.id, {
        status: 'COMPLETED',
        rowsTotal,
        rowsIndexed,
        rowsFailed,
        errors,
        finishedAt: this.clock.now(),
      });
    } catch (error) {
      return await this.jobs.update(job.id, {
        status: 'FAILED',
        rowsTotal,
        rowsIndexed,
        rowsFailed,
        errors,
        errorMessage: error instanceof Error ? error.message : 'Error desconocido',
        finishedAt: this.clock.now(),
      });
    }
  }
}
