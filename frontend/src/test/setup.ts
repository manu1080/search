import '@testing-library/jest-dom/vitest';

// jsdom no implementa matchMedia y el hook de tema lo consulta al arrancar.
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

/**
 * En Node 25 el `localStorage` global exige arrancar con `--localstorage-file`
 * y lanza al tocarlo, asi que se sustituye por uno en memoria. La app ya trata
 * el almacenamiento como algo que puede fallar; esto solo permite que los tests
 * ejerciten el camino en el que si funciona.
 */
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
  } as Storage;
}

function storageIsUsable(): boolean {
  try {
    const probe = '__probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

if (!storageIsUsable()) {
  const memory = createMemoryStorage();
  Object.defineProperty(window, 'localStorage', { value: memory, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: memory, configurable: true });
}
