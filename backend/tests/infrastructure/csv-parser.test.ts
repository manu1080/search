import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import type { ParsedBatch } from '../../src/core/uploads/csv-parser.port.js';
import { CsvProductParserAdapter } from '../../src/infrastructure/csv/csv-product.parser.js';

const HEADER = 'sku,name,description,brand,category,price,currency,stock,rating,imageUrl,tags';

async function parseAll(csv: string, batchSize = 500): Promise<ParsedBatch[]> {
  const parser = new CsvProductParserAdapter(() => new Date('2026-01-01T00:00:00Z'));
  const batches: ParsedBatch[] = [];
  for await (const batch of parser.parse(Readable.from([csv]), batchSize)) {
    batches.push(batch);
  }
  return batches;
}

describe('CsvProductParserAdapter', () => {
  it('convierte una fila completa en un producto', async () => {
    const [batch] = await parseAll(
      `${HEADER}\nSKU-1,Auriculares,Con cable,Sony,Audio,99.90,eur,5,4.5,https://x.test/a.jpg,audio|sony\n`,
    );

    expect(batch?.products[0]).toEqual({
      sku: 'SKU-1',
      name: 'Auriculares',
      description: 'Con cable',
      brand: 'Sony',
      category: 'Audio',
      price: 99.9,
      currency: 'EUR',
      stock: 5,
      rating: 4.5,
      imageUrl: 'https://x.test/a.jpg',
      tags: ['audio', 'sony'],
      indexedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  it('acepta precios con coma decimal', async () => {
    const [batch] = await parseAll(`${HEADER}\nSKU-1,Altavoz,d,JBL,Audio,"12,50",EUR,1,4,,x\n`);

    expect(batch?.products[0]?.price).toBe(12.5);
  });

  it('aplica valores por defecto a las columnas opcionales', async () => {
    const [batch] = await parseAll(`${HEADER}\nSKU-1,Altavoz,,,,10,,,,,\n`);

    expect(batch?.products[0]).toMatchObject({
      brand: 'Sin marca',
      category: 'Sin categoría',
      currency: 'EUR',
      stock: 0,
      rating: 0,
      imageUrl: null,
      tags: [],
    });
  });

  it('reporta la línea real del fichero al fallar una fila', async () => {
    const [batch] = await parseAll(
      `${HEADER}\nSKU-1,Ok,d,Sony,Audio,10,EUR,1,4,,x\nSKU-2,,d,Sony,Audio,10,EUR,1,4,,x\n`,
    );

    expect(batch?.errors).toEqual([{ line: 3, message: 'name: name es obligatorio' }]);
  });

  it('lee ficheros con finales de línea mezclados', async () => {
    const [batch] = await parseAll(
      `${HEADER}\r\nSKU-1,Uno,d,Sony,Audio,10,EUR,1,4,,x\nSKU-2,Dos,d,Sony,Audio,10,EUR,1,4,,x\n`,
    );

    expect(batch?.rowsRead).toBe(2);
    expect(batch?.products).toHaveLength(2);
  });

  it('ignora espacios y BOM en la cabecera', async () => {
    const [batch] = await parseAll(
      `﻿ sku , name ,description,brand,category,price,currency,stock,rating,imageUrl,tags\nSKU-1,Uno,d,Sony,Audio,10,EUR,1,4,,x\n`,
    );

    expect(batch?.products[0]?.sku).toBe('SKU-1');
  });

  it('trocea la salida en lotes del tamaño pedido', async () => {
    const rows = Array.from(
      { length: 5 },
      (_, i) => `SKU-${i},Producto ${i},d,Sony,Audio,10,EUR,1,4,,x`,
    ).join('\n');

    const batches = await parseAll(`${HEADER}\n${rows}\n`, 2);

    expect(batches.map((batch) => batch.products.length)).toEqual([2, 2, 1]);
  });

  it('descarta una url de imagen inválida en vez de indexarla', async () => {
    const [batch] = await parseAll(`${HEADER}\nSKU-1,Uno,d,Sony,Audio,10,EUR,1,4,no-es-url,x\n`);

    expect(batch?.products).toHaveLength(0);
    expect(batch?.errors[0]?.message).toContain('imageUrl');
  });
});
