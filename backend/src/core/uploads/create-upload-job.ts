import { ValidationError } from '../shared/errors.js';
import type { IdGenerator } from '../shared/id-generator.js';
import type { FileStorage } from './file-storage.port.js';
import type { JobPublisher } from './job-publisher.port.js';
import type { UploadJob } from './upload-job.js';
import type { UploadJobRepository } from './upload-job-repository.port.js';

export interface CreateUploadJobInput {
  userId: string;
  originalName: string;
  content: Buffer;
}

/**
 * Registra la subida y delega el trabajo pesado en la cola: la petición HTTP
 * responde en cuanto el fichero esta a salvo en disco y el mensaje publicado.
 */
export class CreateUploadJob {
  constructor(
    private readonly jobs: UploadJobRepository,
    private readonly storage: FileStorage,
    private readonly publisher: JobPublisher,
    private readonly ids: IdGenerator,
  ) {}

  async execute(input: CreateUploadJobInput): Promise<UploadJob> {
    if (input.content.byteLength === 0) {
      throw new ValidationError('El fichero CSV esta vacio');
    }
    if (!input.originalName.toLowerCase().endsWith('.csv')) {
      throw new ValidationError('Solo se aceptan ficheros .csv');
    }

    const jobId = this.ids.generate();
    const stored = await this.storage.save(`${jobId}.csv`, input.content);

    const job = await this.jobs.create({
      id: jobId,
      userId: input.userId,
      originalName: input.originalName,
      storedPath: stored.path,
      sizeBytes: stored.sizeBytes,
    });

    try {
      await this.publisher.publishCsvImport({ jobId: job.id, userId: input.userId });
    } catch (error) {
      // Si la cola no acepta el mensaje el job nunca se procesaria: se marca
      // fallido en el momento en lugar de dejarlo colgado en PENDING.
      await this.jobs.update(job.id, {
        status: 'FAILED',
        errorMessage: 'No se pudo encolar el procesado del fichero',
        finishedAt: new Date(),
      });
      throw error;
    }

    return job;
  }
}
