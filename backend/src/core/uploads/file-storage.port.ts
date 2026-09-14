import type { Readable } from 'node:stream';

export interface StoredFile {
  path: string;
  sizeBytes: number;
}

export interface FileStorage {
  /** Guarda el contenido y devuelve una ruta reutilizable por el worker. */
  save(key: string, content: Buffer): Promise<StoredFile>;
  openRead(path: string): Readable;
  remove(path: string): Promise<void>;
}
