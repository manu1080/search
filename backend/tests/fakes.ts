import type { PasswordHasher } from '../src/core/auth/password-hasher.port.js';
import type { TokenIssuer, TokenPayload } from '../src/core/auth/token-issuer.port.js';
import type { ProductIndexRepository, BulkIndexResult } from '../src/core/products/product-index-repository.port.js';
import type { Product } from '../src/core/products/product.js';
import type { Clock } from '../src/core/shared/clock.js';
import type { IdGenerator } from '../src/core/shared/id-generator.js';
import type { FileStorage, StoredFile } from '../src/core/uploads/file-storage.port.js';
import type { CsvImportMessage, JobPublisher } from '../src/core/uploads/job-publisher.port.js';
import type { UploadJob } from '../src/core/uploads/upload-job.js';
import type {
  CreateUploadJobInput,
  UpdateUploadJobInput,
  UploadJobRepository,
} from '../src/core/uploads/upload-job-repository.port.js';
import type { UserWithCredentials } from '../src/core/users/user.js';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserRepository,
} from '../src/core/users/user-repository.port.js';
import { Readable } from 'node:stream';

export class InMemoryUserRepository implements UserRepository {
  private readonly rows = new Map<string, UserWithCredentials>();
  private sequence = 0;

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }

  async findByEmail(email: string) {
    return [...this.rows.values()].find((row) => row.email === email) ?? null;
  }

  async create(input: CreateUserInput) {
    const now = new Date('2026-01-01T00:00:00Z');
    const user: UserWithCredentials = {
      id: `user-${++this.sequence}`,
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      bio: null,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(user.id, user);
    return user;
  }

  async update(id: string, input: UpdateUserInput) {
    const current = this.rows.get(id);
    if (!current) throw new Error('usuario inexistente');
    const updated = { ...current, ...input, updatedAt: new Date() };
    this.rows.set(id, updated);
    return updated;
  }
}

export class InMemoryUploadJobRepository implements UploadJobRepository {
  readonly rows = new Map<string, UploadJob>();

  async create(input: CreateUploadJobInput) {
    const job: UploadJob = {
      ...input,
      status: 'PENDING',
      rowsTotal: 0,
      rowsIndexed: 0,
      rowsFailed: 0,
      errors: [],
      errorMessage: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      startedAt: null,
      finishedAt: null,
    };
    this.rows.set(job.id, job);
    return job;
  }

  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }

  async listByUser(userId: string, limit: number) {
    return [...this.rows.values()].filter((job) => job.userId === userId).slice(0, limit);
  }

  async update(id: string, input: UpdateUploadJobInput) {
    const current = this.rows.get(id);
    if (!current) throw new Error('job inexistente');
    const updated = { ...current, ...input } as UploadJob;
    this.rows.set(id, updated);
    return updated;
  }
}

export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string) {
    return `hashed:${plain}`;
  }

  async verify(plain: string, hash: string) {
    return hash === `hashed:${plain}`;
  }
}

export class FakeTokenIssuer implements TokenIssuer {
  issue(payload: TokenPayload) {
    return `token:${payload.sub}:${payload.email}`;
  }

  verify(token: string): TokenPayload {
    const [, sub, email] = token.split(':');
    return { sub: sub ?? '', email: email ?? '' };
  }
}

export class InMemoryFileStorage implements FileStorage {
  readonly files = new Map<string, Buffer>();

  async save(key: string, content: Buffer): Promise<StoredFile> {
    this.files.set(key, content);
    return { path: key, sizeBytes: content.byteLength };
  }

  openRead(path: string) {
    return Readable.from([this.files.get(path) ?? Buffer.alloc(0)]);
  }

  async remove(path: string) {
    this.files.delete(path);
  }
}

export class RecordingJobPublisher implements JobPublisher {
  readonly published: CsvImportMessage[] = [];
  shouldFail = false;

  async publishCsvImport(message: CsvImportMessage) {
    if (this.shouldFail) throw new Error('broker caido');
    this.published.push(message);
  }
}

export class InMemoryProductIndex implements ProductIndexRepository {
  readonly documents = new Map<string, Product>();
  failSkus: string[] = [];

  async ensureIndex() {}

  async bulkIndex(products: Product[]): Promise<BulkIndexResult> {
    let indexed = 0;
    const errors: string[] = [];
    for (const product of products) {
      if (this.failSkus.includes(product.sku)) {
        errors.push(`sku ${product.sku}: rechazado`);
        continue;
      }
      this.documents.set(product.sku, product);
      indexed += 1;
    }
    return { indexed, failed: errors.length, errors };
  }

  async refresh() {}
}

export const fixedClock: Clock = { now: () => new Date('2026-01-01T12:00:00Z') };

export function sequentialIds(prefix = 'id'): IdGenerator {
  let counter = 0;
  return { generate: () => `${prefix}-${++counter}` };
}
