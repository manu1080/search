import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalFileStorage } from '../../src/infrastructure/storage/local-file.storage.js';

let root: string;
let storage: LocalFileStorage;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'search-storage-'));
  storage = new LocalFileStorage(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

describe('LocalFileStorage', () => {
  it('guarda el contenido y devuelve ruta y tamaño', async () => {
    const stored = await storage.save('job-1.csv', Buffer.from('hola'));

    expect(stored.sizeBytes).toBe(4);
    expect(await readFile(stored.path, 'utf8')).toBe('hola');
  });

  it('crea el directorio de subidas si no existe', async () => {
    const anidado = new LocalFileStorage(path.join(root, 'sub', 'dir'));

    const stored = await anidado.save('job-1.csv', Buffer.from('x'));

    expect(await readFile(stored.path, 'utf8')).toBe('x');
  });

  it('se queda con el nombre base: una clave con ../ no escapa del directorio', async () => {
    const stored = await storage.save('../../fuera.csv', Buffer.from('x'));

    expect(path.dirname(stored.path)).toBe(path.resolve(root));
    expect(path.basename(stored.path)).toBe('fuera.csv');
  });

  it('lee de vuelta lo que ha guardado', async () => {
    const stored = await storage.save('job-1.csv', Buffer.from('sku,name\n1,uno\n'));

    expect(await readStream(storage.openRead(stored.path))).toBe('sku,name\n1,uno\n');
  });

  it('se niega a leer una ruta fuera del directorio de subidas', async () => {
    const fuera = path.join(tmpdir(), 'search-fuera.csv');
    await writeFile(fuera, 'secreto');

    expect(() => storage.openRead(fuera)).toThrow('fuera del directorio de subidas');

    await rm(fuera, { force: true });
  });

  it('se niega a borrar una ruta fuera del directorio de subidas', async () => {
    await expect(storage.remove('/etc/hosts')).rejects.toThrow('fuera del directorio de subidas');
  });

  it('borra un fichero propio sin quejarse si ya no esta', async () => {
    const stored = await storage.save('job-1.csv', Buffer.from('x'));

    await storage.remove(stored.path);
    await expect(storage.remove(stored.path)).resolves.toBeUndefined();
  });
});
