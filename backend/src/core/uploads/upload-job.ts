export const UPLOAD_JOB_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const;

export type UploadJobStatus = (typeof UPLOAD_JOB_STATUSES)[number];

export interface UploadJobRowError {
  line: number;
  message: string;
}

export interface UploadJob {
  id: string;
  userId: string;
  originalName: string;
  storedPath: string;
  sizeBytes: number;
  status: UploadJobStatus;
  rowsTotal: number;
  rowsIndexed: number;
  rowsFailed: number;
  errors: UploadJobRowError[];
  errorMessage: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
}

/** Número máximo de errores de fila que se guardan por job (evita filas infinitas en BD). */
export const MAX_STORED_ROW_ERRORS = 50;
