import type { Readable } from 'node:stream';
import type { Product } from '../products/product.js';
import type { UploadJobRowError } from './upload-job.js';

export interface ParsedBatch {
  products: Product[];
  errors: UploadJobRowError[];
  rowsRead: number;
}

export interface CsvProductParser {
  /**
   * Recorre el CSV en streaming y emite lotes ya validados, de forma que un
   * fichero grande nunca se materializa entero en memoria.
   */
  parse(stream: Readable, batchSize: number): AsyncIterable<ParsedBatch>;
}
