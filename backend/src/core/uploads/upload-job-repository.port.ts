import type { UploadJob, UploadJobRowError, UploadJobStatus } from './upload-job.js';

export interface CreateUploadJobInput {
  id: string;
  userId: string;
  originalName: string;
  storedPath: string;
  sizeBytes: number;
}

export interface UpdateUploadJobInput {
  status?: UploadJobStatus;
  rowsTotal?: number;
  rowsIndexed?: number;
  rowsFailed?: number;
  errors?: UploadJobRowError[];
  errorMessage?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
}

export interface UploadJobRepository {
  create(input: CreateUploadJobInput): Promise<UploadJob>;
  findById(id: string): Promise<UploadJob | null>;
  listByUser(userId: string, limit: number): Promise<UploadJob[]>;
  update(id: string, input: UpdateUploadJobInput): Promise<UploadJob>;
}
