import { randomUUID } from 'node:crypto';

/** Generador de identificadores inyectable (permite ids fijos en tests). */
export interface IdGenerator {
  generate(): string;
}

export const uuidGenerator: IdGenerator = {
  generate: () => randomUUID(),
};
