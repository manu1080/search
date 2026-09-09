/** Fuente de tiempo inyectable: mantiene los casos de uso deterministas en tests. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
