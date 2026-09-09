import type { SearchFilters, SearchResult, UploadJob, User } from './types';

const TOKEN_KEY = 'search.token';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const tokenStorage = {
  get: (): string | null => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token: string): void => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* modo privado: la sesión dura lo que la pestana */
    }
  },
  clear: (): void => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* nada que limpiar */
    }
  },
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStorage.get();
  const isFormData = init.body instanceof FormData;

  const response = await fetch(path, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const error = (payload as { error?: { message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(
      error?.message ?? 'No se ha podido completar la operación',
      response.status,
      error?.details as { path: string; message: string }[] | undefined,
    );
  }

  return payload as T;
}

/** Construye la query string de búsqueda omitiendo lo que este vacio. */
export function buildSearchParams(filters: SearchFilters, size = 24): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  for (const brand of filters.brands) params.append('brand', brand);
  for (const category of filters.categories) params.append('category', category);
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
  if (filters.inStockOnly) params.set('inStock', 'true');
  if (filters.sort !== 'relevance') params.set('sort', filters.sort);
  if (filters.page > 1) params.set('page', String(filters.page));
  params.set('size', String(size));
  return params;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, password: string) =>
    request<{ token: string; user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  me: () => request<{ user: User }>('/api/auth/me'),

  updateProfile: (input: Partial<Pick<User, 'name' | 'email' | 'bio' | 'avatarUrl'>>) =>
    request<{ user: User }>('/api/profile', { method: 'PATCH', body: JSON.stringify(input) }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/api/profile/password', {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  search: (filters: SearchFilters, size?: number, signal?: AbortSignal) =>
    request<SearchResult>(`/api/search?${buildSearchParams(filters, size).toString()}`, { signal }),

  suggest: (q: string, signal?: AbortSignal) =>
    request<{ suggestions: string[] }>(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
      signal,
    }),

  uploadCsv: (file: File) => {
    const body = new FormData();
    body.append('file', file);
    return request<{ job: UploadJob }>('/api/uploads/csv', { method: 'POST', body });
  },

  listJobs: () => request<{ jobs: UploadJob[] }>('/api/uploads'),

  getJob: (id: string) => request<{ job: UploadJob }>(`/api/uploads/${id}`),
};
