import type { Channel } from 'amqplib';

export const EXCHANGE = 'products';
export const DLX_EXCHANGE = 'products.dlx';
export const CSV_IMPORT_QUEUE = 'products.csv.import';
export const CSV_IMPORT_DLQ = 'products.csv.import.dlq';
export const CSV_IMPORT_ROUTING_KEY = 'csv.import';
export const CSV_IMPORT_DLQ_ROUTING_KEY = 'csv.import.failed';

/**
 * Declara exchanges y colas. La declara tanto el publisher como el consumer:
 * es idempotente y evita depender del orden de arranque de los procesos.
 */
export async function assertTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
  await channel.assertExchange(DLX_EXCHANGE, 'topic', { durable: true });

  await channel.assertQueue(CSV_IMPORT_DLQ, { durable: true });
  await channel.bindQueue(CSV_IMPORT_DLQ, DLX_EXCHANGE, CSV_IMPORT_DLQ_ROUTING_KEY);

  await channel.assertQueue(CSV_IMPORT_QUEUE, {
    durable: true,
    deadLetterExchange: DLX_EXCHANGE,
    deadLetterRoutingKey: CSV_IMPORT_DLQ_ROUTING_KEY,
  });
  await channel.bindQueue(CSV_IMPORT_QUEUE, EXCHANGE, CSV_IMPORT_ROUTING_KEY);
}
