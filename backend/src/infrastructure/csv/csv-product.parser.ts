import { parse } from 'csv-parse';
import type { Readable } from 'node:stream';
import { normalizeRawRow, productRowSchema, type Product } from '../../core/products/product.js';
import type { CsvProductParser, ParsedBatch } from '../../core/uploads/csv-parser.port.js';
import type { UploadJobRowError } from '../../core/uploads/upload-job.js';

export class CsvProductParserAdapter implements CsvProductParser {
  constructor(private readonly now: () => Date = () => new Date()) {}

  async *parse(stream: Readable, batchSize: number): AsyncIterable<ParsedBatch> {
    const records = stream.pipe(
      parse({
        columns: (header: string[]) => header.map((column) => column.trim()),
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
        // Sin esto csv-parse fija el separador de línea con la primera fila y
        // un fichero con finales de línea mezclados se lee como una sola fila.
        record_delimiter: ['\r\n', '\n', '\r'],
      }),
    );

    let products: Product[] = [];
    let errors: UploadJobRowError[] = [];
    let rowsRead = 0;
    let line = 1; // la línea 1 es la cabecera

    for await (const raw of records) {
      line += 1;
      rowsRead += 1;

      const parsed = productRowSchema.safeParse(normalizeRawRow(raw as Record<string, unknown>));
      if (parsed.success) {
        products.push({ ...parsed.data, indexedAt: this.now().toISOString() });
      } else {
        errors.push({
          line,
          message: parsed.error.issues
            .map((issue) => `${issue.path.join('.') || 'fila'}: ${issue.message}`)
            .join('; '),
        });
      }

      if (products.length >= batchSize) {
        yield { products, errors, rowsRead };
        products = [];
        errors = [];
        rowsRead = 0;
      }
    }

    if (products.length > 0 || errors.length > 0 || rowsRead > 0) {
      yield { products, errors, rowsRead };
    }
  }
}
