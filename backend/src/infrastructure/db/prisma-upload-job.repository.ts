import type { PrismaClient } from '../../generated/prisma/client.js';
import type { UploadJob, UploadJobRowError } from '../../core/uploads/upload-job.js';
import type {
  CreateUploadJobInput,
  UpdateUploadJobInput,
  UploadJobRepository,
} from '../../core/uploads/upload-job-repository.port.js';

type PrismaUploadJob = Awaited<ReturnType<PrismaClient['uploadJob']['create']>>;

function toDomain(row: PrismaUploadJob): UploadJob {
  return {
    id: row.id,
    userId: row.userId,
    originalName: row.originalName,
    storedPath: row.storedPath,
    sizeBytes: row.sizeBytes,
    status: row.status,
    rowsTotal: row.rowsTotal,
    rowsIndexed: row.rowsIndexed,
    rowsFailed: row.rowsFailed,
    errors: (row.errors as UploadJobRowError[] | null) ?? [],
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
  };
}

export class PrismaUploadJobRepository implements UploadJobRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: CreateUploadJobInput): Promise<UploadJob> {
    return toDomain(await this.db.uploadJob.create({ data: input }));
  }

  async findById(id: string): Promise<UploadJob | null> {
    const row = await this.db.uploadJob.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async listByUser(userId: string, limit: number): Promise<UploadJob[]> {
    const rows = await this.db.uploadJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(toDomain);
  }

  async update(id: string, input: UpdateUploadJobInput): Promise<UploadJob> {
    const { errors, ...rest } = input;
    return toDomain(
      await this.db.uploadJob.update({
        where: { id },
        // errors es una columna Json: Prisma exige el tipo InputJsonValue.
        data: { ...rest, ...(errors !== undefined ? { errors: errors as unknown as object[] } : {}) },
      }),
    );
  }
}
