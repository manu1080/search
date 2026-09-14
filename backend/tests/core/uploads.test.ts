import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../src/core/shared/errors.js';
import { CreateUploadJob } from '../../src/core/uploads/create-upload-job.js';
import { GetUploadJob } from '../../src/core/uploads/list-upload-jobs.js';
import { ProcessUploadJob } from '../../src/core/uploads/process-upload-job.js';
import { CsvProductParserAdapter } from '../../src/infrastructure/csv/csv-product.parser.js';
import {
  fixedClock,
  InMemoryFileStorage,
  InMemoryProductIndex,
  InMemoryUploadJobRepository,
  RecordingJobPublisher,
  sequentialIds,
} from '../fakes.js';

const HEADER = 'sku,name,description,brand,category,price,currency,stock,rating,imageUrl,tags';
const VALID_ROW = 'SKU-1,Auriculares,Con cable,Sony,Audio,99.90,EUR,5,4.5,https://x.test/a.jpg,audio|sony';

function buildCreate() {
  const jobs = new InMemoryUploadJobRepository();
  const storage = new InMemoryFileStorage();
  const publisher = new RecordingJobPublisher();
  return {
    jobs,
    storage,
    publisher,
    useCase: new CreateUploadJob(jobs, storage, publisher, sequentialIds('job')),
  };
}

describe('CreateUploadJob', () => {
  it('guarda el fichero, crea el job en PENDING y pública el mensaje', async () => {
    const { useCase, storage, publisher } = buildCreate();

    const job = await useCase.execute({
      userId: 'user-1',
      originalName: 'productos.csv',
      content: Buffer.from(`${HEADER}\n${VALID_ROW}\n`),
    });

    expect(job.status).toBe('PENDING');
    expect(storage.files.has('job-1.csv')).toBe(true);
    expect(publisher.published).toEqual([{ jobId: 'job-1', userId: 'user-1' }]);
  });

  it('rechaza ficheros que no son csv', async () => {
    const { useCase } = buildCreate();

    await expect(
      useCase.execute({ userId: 'u', originalName: 'notas.txt', content: Buffer.from('hola') }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rechaza ficheros vacios', async () => {
    const { useCase } = buildCreate();

    await expect(
      useCase.execute({ userId: 'u', originalName: 'vacio.csv', content: Buffer.alloc(0) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('marca el job como fallido si la cola no acepta el mensaje', async () => {
    const { useCase, publisher, jobs } = buildCreate();
    publisher.shouldFail = true;

    await expect(
      useCase.execute({
        userId: 'u',
        originalName: 'p.csv',
        content: Buffer.from(`${HEADER}\n${VALID_ROW}\n`),
      }),
    ).rejects.toThrow('broker caido');

    expect(jobs.rows.get('job-1')?.status).toBe('FAILED');
  });
});

function buildProcess(csv: string) {
  const jobs = new InMemoryUploadJobRepository();
  const storage = new InMemoryFileStorage();
  const index = new InMemoryProductIndex();
  const useCase = new ProcessUploadJob(
    jobs,
    storage,
    new CsvProductParserAdapter(() => new Date('2026-01-01T12:00:00Z')),
    index,
    fixedClock,
  );
  const setup = async () => {
    await storage.save('job-1.csv', Buffer.from(csv));
    await jobs.create({
      id: 'job-1',
      userId: 'user-1',
      originalName: 'p.csv',
      storedPath: 'job-1.csv',
      sizeBytes: csv.length,
    });
  };
  return { jobs, index, useCase, setup };
}

describe('ProcessUploadJob', () => {
  it('indexa las filas validas y completa el job', async () => {
    const { useCase, index, setup } = buildProcess(
      `${HEADER}\n${VALID_ROW}\nSKU-2,Altavoz,Portátil,JBL,Audio,49.5,EUR,10,4,,altavoz\n`,
    );
    await setup();

    const job = await useCase.execute('job-1');

    expect(job.status).toBe('COMPLETED');
    expect(job.rowsTotal).toBe(2);
    expect(job.rowsIndexed).toBe(2);
    expect(job.rowsFailed).toBe(0);
    expect(index.documents.get('SKU-2')?.imageUrl).toBeNull();
  });

  it('cuenta las filas inválidas sin abortar el resto', async () => {
    const { useCase, index, setup } = buildProcess(
      `${HEADER}\n${VALID_ROW}\nSKU-2,,sin nombre,JBL,Audio,10,EUR,1,4,,x\n`,
    );
    await setup();

    const job = await useCase.execute('job-1');

    expect(job.status).toBe('COMPLETED');
    expect(job.rowsTotal).toBe(2);
    expect(job.rowsIndexed).toBe(1);
    expect(job.rowsFailed).toBe(1);
    expect(job.errors[0]?.line).toBe(3);
    expect(index.documents.size).toBe(1);
  });

  it('suma los rechazos del motor de búsqueda a las filas fallidas', async () => {
    const { useCase, index, setup } = buildProcess(`${HEADER}\n${VALID_ROW}\n`);
    await setup();
    index.failSkus = ['SKU-1'];

    const job = await useCase.execute('job-1');

    expect(job.rowsIndexed).toBe(0);
    expect(job.rowsFailed).toBe(1);
  });

  it('marca FAILED si el fichero no se puede leer', async () => {
    const { useCase, jobs } = buildProcess('');
    await jobs.create({
      id: 'job-1',
      userId: 'user-1',
      originalName: 'p.csv',
      storedPath: 'no-existe.csv',
      sizeBytes: 0,
    });

    const job = await useCase.execute('job-1');

    expect(job.status).toBe('COMPLETED');
    expect(job.rowsTotal).toBe(0);
  });

  it('es idempotente: no reprocesa un job ya completado', async () => {
    const { useCase, index, setup } = buildProcess(`${HEADER}\n${VALID_ROW}\n`);
    await setup();
    await useCase.execute('job-1');
    index.documents.clear();

    await useCase.execute('job-1');

    expect(index.documents.size).toBe(0);
  });
});

describe('GetUploadJob', () => {
  it('no deja ver el job de otro usuario', async () => {
    const jobs = new InMemoryUploadJobRepository();
    await jobs.create({
      id: 'job-1',
      userId: 'user-1',
      originalName: 'p.csv',
      storedPath: 'job-1.csv',
      sizeBytes: 1,
    });

    await expect(new GetUploadJob(jobs).execute('job-1', 'otro-user')).rejects.toThrow(
      'pertenece a otro usuario',
    );
  });
});
