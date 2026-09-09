import express from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { LoginUser } from '../../src/core/auth/login-user.js';
import { RegisterUser } from '../../src/core/auth/register-user.js';
import type {
  ProductSearchRepository,
  SearchProductsQuery,
  SearchProductsResult,
} from '../../src/core/products/product-search-repository.port.js';
import { SearchProducts, SuggestProducts } from '../../src/core/products/search-products.js';
import { ChangePassword, GetProfile, UpdateProfile } from '../../src/core/users/update-profile.js';
import { CreateUploadJob } from '../../src/core/uploads/create-upload-job.js';
import { GetUploadJob, ListUploadJobs } from '../../src/core/uploads/list-upload-jobs.js';
import type { Container } from '../../src/container.js';
import { createApp } from '../../src/http/app.js';
import {
  FakePasswordHasher,
  FakeTokenIssuer,
  InMemoryFileStorage,
  InMemoryUploadJobRepository,
  InMemoryUserRepository,
  RecordingJobPublisher,
  sequentialIds,
} from '../fakes.js';

/** Repositorio de búsqueda de mentira: la API se prueba sin levantar OpenSearch. */
class StubSearchRepository implements ProductSearchRepository {
  lastQuery?: SearchProductsQuery;

  async search(query: SearchProductsQuery): Promise<SearchProductsResult> {
    this.lastQuery = query;
    return {
      hits: [],
      total: 0,
      page: query.page,
      size: query.size,
      tookMs: 1,
      typoTolerant: query.typoTolerant,
      facets: { brands: [], categories: [], price: null },
    };
  }

  async suggest(prefix: string) {
    return [`${prefix}culares`];
  }
}

function buildTestApp() {
  const users = new InMemoryUserRepository();
  const jobs = new InMemoryUploadJobRepository();
  const storage = new InMemoryFileStorage();
  const publisher = new RecordingJobPublisher();
  const hasher = new FakePasswordHasher();
  const tokens = new FakeTokenIssuer();
  const searchRepository = new StubSearchRepository();

  const container = {
    config: {
      CORS_ORIGIN: 'http://localhost:5173',
      MAX_UPLOAD_BYTES: 1024 * 1024,
    },
    logger: pino({ level: 'silent' }),
    db: { $queryRaw: async () => [{ ok: 1 }] },
    rabbit: { channelReady: async () => ({}) },
    searchClient: { ping: async () => ({}) },
    tokens,
    useCases: {
      registerUser: new RegisterUser(users, hasher, tokens),
      loginUser: new LoginUser(users, hasher, tokens),
      getProfile: new GetProfile(users),
      updateProfile: new UpdateProfile(users),
      changePassword: new ChangePassword(users, hasher),
      searchProducts: new SearchProducts(searchRepository),
      suggestProducts: new SuggestProducts(searchRepository),
      createUploadJob: new CreateUploadJob(jobs, storage, publisher, sequentialIds('job')),
      listUploadJobs: new ListUploadJobs(jobs),
      getUploadJob: new GetUploadJob(jobs),
    },
  } as unknown as Container;

  return { app: createApp(container) as express.Express, searchRepository, publisher, jobs };
}

const CSV = Buffer.from(
  'sku,name,description,brand,category,price,currency,stock,rating,imageUrl,tags\n' +
    'SKU-1,Auriculares,d,Sony,Audio,10,EUR,1,4,,audio\n',
);

let ctx: ReturnType<typeof buildTestApp>;

beforeEach(() => {
  ctx = buildTestApp();
});

async function registerAndLogin(): Promise<string> {
  const response = await request(ctx.app)
    .post('/api/auth/register')
    .send({ name: 'Manu', email: 'manu@example.com', password: 'secreto123' });
  return response.body.token as string;
}

describe('salud y rutas desconocidas', () => {
  it('GET /health responde ok', async () => {
    const response = await request(ctx.app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('devuelve 404 json en una ruta inexistente', async () => {
    const response = await request(ctx.app).get('/api/no-existe');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('autenticación', () => {
  it('registra y devuelve 201 con token', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Manu', email: 'manu@example.com', password: 'secreto123' });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.passwordHash).toBeUndefined();
  });

  it('rechaza una contraseña corta con 422', async () => {
    const response = await request(ctx.app)
      .post('/api/auth/register')
      .send({ name: 'Manu', email: 'manu@example.com', password: '123' });

    expect(response.status).toBe(422);
    expect(response.body.error.details[0].path).toBe('password');
  });

  it('devuelve 401 con credenciales incorrectas', async () => {
    await registerAndLogin();

    const response = await request(ctx.app)
      .post('/api/auth/login')
      .send({ email: 'manu@example.com', password: 'incorrecta' });

    expect(response.status).toBe(401);
  });

  it('protege /api/auth/me sin token', async () => {
    expect((await request(ctx.app).get('/api/auth/me')).status).toBe(401);
  });

  it('devuelve el usuario con un token valido', async () => {
    const token = await registerAndLogin();

    const response = await request(ctx.app).get('/api/auth/me').set('authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe('manu@example.com');
  });
});

describe('búsqueda pública', () => {
  it('responde sin token', async () => {
    const response = await request(ctx.app).get('/api/search?q=auriculares');

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(0);
  });

  it('acepta filtros repetidos y separados por coma', async () => {
    await request(ctx.app).get('/api/search?brand=Sony&brand=JBL&category=Audio,Gaming');

    expect(ctx.searchRepository.lastQuery?.brands).toEqual(['Sony', 'JBL']);
    expect(ctx.searchRepository.lastQuery?.categories).toEqual(['Audio', 'Gaming']);
  });

  it('rechaza un tamaño de página fuera de rango', async () => {
    expect((await request(ctx.app).get('/api/search?size=500')).status).toBe(422);
  });

  it('expone sugerencias', async () => {
    const response = await request(ctx.app).get('/api/search/suggest?q=auri');

    expect(response.body.suggestions).toEqual(['auriculares']);
  });
});

describe('subida de csv', () => {
  it('exige autenticación', async () => {
    const response = await request(ctx.app)
      .post('/api/uploads/csv')
      .attach('file', CSV, 'productos.csv');

    expect(response.status).toBe(401);
  });

  it('acepta el fichero con 202 y encola el trabajo', async () => {
    const token = await registerAndLogin();

    const response = await request(ctx.app)
      .post('/api/uploads/csv')
      .set('authorization', `Bearer ${token}`)
      .attach('file', CSV, 'productos.csv');

    expect(response.status).toBe(202);
    expect(response.body.job.status).toBe('PENDING');
    expect(ctx.publisher.published).toHaveLength(1);
  });

  it('rechaza un fichero que no es csv', async () => {
    const token = await registerAndLogin();

    const response = await request(ctx.app)
      .post('/api/uploads/csv')
      .set('authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('{}'), 'datos.json');

    expect(response.status).toBe(422);
  });

  it('devuelve 413 si el fichero supera el limite', async () => {
    const token = await registerAndLogin();

    const response = await request(ctx.app)
      .post('/api/uploads/csv')
      .set('authorization', `Bearer ${token}`)
      .attach('file', Buffer.alloc(2 * 1024 * 1024, 'a'), 'grande.csv');

    expect(response.status).toBe(413);
  });

  it('no deja consultar el job de otro usuario', async () => {
    const token = await registerAndLogin();
    const upload = await request(ctx.app)
      .post('/api/uploads/csv')
      .set('authorization', `Bearer ${token}`)
      .attach('file', CSV, 'productos.csv');

    const otherToken = new FakeTokenIssuer().issue({ sub: 'otro', email: 'otro@example.com' });
    const response = await request(ctx.app)
      .get(`/api/uploads/${upload.body.job.id}`)
      .set('authorization', `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
  });
});

describe('perfil', () => {
  it('actualiza los datos del usuario autenticado', async () => {
    const token = await registerAndLogin();

    const response = await request(ctx.app)
      .patch('/api/profile')
      .set('authorization', `Bearer ${token}`)
      .send({ name: 'Manuel', bio: 'Hola' });

    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe('Manuel');
    expect(response.body.user.bio).toBe('Hola');
  });

  it('rechaza una url de avatar inválida', async () => {
    const token = await registerAndLogin();

    const response = await request(ctx.app)
      .patch('/api/profile')
      .set('authorization', `Bearer ${token}`)
      .send({ avatarUrl: 'no-es-una-url' });

    expect(response.status).toBe(422);
  });

  it('cambia la contraseña y responde 204', async () => {
    const token = await registerAndLogin();

    const response = await request(ctx.app)
      .patch('/api/profile/password')
      .set('authorization', `Bearer ${token}`)
      .send({ currentPassword: 'secreto123', newPassword: 'otraclave123' });

    expect(response.status).toBe(204);
  });
});
