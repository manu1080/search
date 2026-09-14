import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, tokenStorage } from './api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cliente de la API', () => {
  it('manda las credenciales y devuelve token y usuario', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ token: 't', user: { id: 'u1' } }));

    const result = await api.login('manu@example.com', 'secreto123');

    expect(result.token).toBe('t');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'manu@example.com',
      password: 'secreto123',
    });
  });

  it('adjunta el token guardado en la cabecera Authorization', async () => {
    tokenStorage.set('mi-token');
    fetchMock.mockResolvedValue(jsonResponse({ user: { id: 'u1' } }));

    await api.me();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer mi-token');
  });

  it('no manda cabecera Authorization si no hay sesion', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ total: 0 }));

    await api.search({
      q: 'x',
      brands: [],
      categories: [],
      inStockOnly: false,
      sort: 'relevance',
      page: 1,
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it('convierte un error del servidor en ApiError con su mensaje', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Email o contraseña incorrectos' } }, 401),
    );

    await expect(api.login('manu@example.com', 'mal')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: 'Email o contraseña incorrectos',
    });
  });

  it('conserva el detalle de validacion que devuelve el servidor', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de entrada inválidos',
            details: [{ path: 'password', message: 'demasiado corta' }],
          },
        },
        422,
      ),
    );

    await expect(api.register('Manu', 'manu@example.com', '123')).rejects.toMatchObject({
      details: [{ path: 'password', message: 'demasiado corta' }],
    });
  });

  it('usa un mensaje generico si la respuesta de error no trae ninguno', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));

    await expect(api.me()).rejects.toThrow('No se ha podido completar la operación');
  });

  it('acepta un 204 sin cuerpo', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(api.changePassword('vieja1234', 'nueva1234')).resolves.toBeUndefined();
  });

  it('sube el CSV como multipart sin forzar el content-type', async () => {
    tokenStorage.set('mi-token');
    fetchMock.mockResolvedValue(jsonResponse({ job: { id: 'job-1' } }, 202));

    await api.uploadCsv(new File(['sku,name\n1,uno\n'], 'productos.csv', { type: 'text/csv' }));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/uploads/csv');
    expect(init.body).toBeInstanceOf(FormData);
    // El navegador debe poner el boundary: si lo fijamos nosotros, el backend no lo parsea.
    expect((init.headers as Record<string, string>)['content-type']).toBeUndefined();
  });
});

describe('tokenStorage', () => {
  it('guarda, lee y limpia el token', () => {
    expect(tokenStorage.get()).toBeNull();

    tokenStorage.set('abc');
    expect(tokenStorage.get()).toBe('abc');

    tokenStorage.clear();
    expect(tokenStorage.get()).toBeNull();
  });

  it('no revienta si el navegador bloquea el almacenamiento', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });

    expect(tokenStorage.get()).toBeNull();

    getItem.mockRestore();
  });
});

describe('ApiError', () => {
  it('expone codigo de estado y mensaje', () => {
    const error = new ApiError('vaya', 500);

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(500);
  });
});
