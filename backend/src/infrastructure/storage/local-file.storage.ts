import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import type { FileStorage, StoredFile } from '../../core/uploads/file-storage.port.js';

/**
 * Almacenamiento en disco local. La clave se sanea para que un nombre de
 * fichero no pueda escapar del directorio de subidas.
 */
export class LocalFileStorage implements FileStorage {
  private readonly root: string;

  constructor(baseDir: string) {
    this.root = path.resolve(baseDir);
  }

  async save(key: string, content: Buffer): Promise<StoredFile> {
    const target = path.join(this.root, path.basename(key));
    await mkdir(this.root, { recursive: true });
    await writeFile(target, content);
    return { path: target, sizeBytes: content.byteLength };
  }

  openRead(filePath: string): Readable {
    return createReadStream(this.resolveInsideRoot(filePath));
  }

  async remove(filePath: string): Promise<void> {
    await rm(this.resolveInsideRoot(filePath), { force: true });
  }

  private resolveInsideRoot(filePath: string): string {
    const resolved = path.resolve(filePath);
    if (resolved !== this.root && !resolved.startsWith(this.root + path.sep)) {
      throw new Error(`Ruta fuera del directorio de subidas: ${filePath}`);
    }
    return resolved;
  }
}
