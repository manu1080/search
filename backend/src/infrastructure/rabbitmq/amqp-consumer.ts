import type { ConsumeMessage } from 'amqplib';
import type { Logger } from 'pino';
import type { CsvImportMessage } from '../../core/uploads/job-publisher.port.js';
import type { RabbitConnection } from './connection.js';
import { CSV_IMPORT_QUEUE } from './topology.js';

export type CsvImportHandler = (message: CsvImportMessage) => Promise<void>;

/**
 * Consumidor de la cola de importación. prefetch 1 para procesar un CSV cada
 * vez, y nack sin requeue ante un mensaje ilegible para que acabe en la DLQ en
 * lugar de rebotar en bucle.
 */
export class AmqpCsvImportConsumer {
  constructor(
    private readonly connection: RabbitConnection,
    private readonly logger: Logger,
  ) {}

  async start(handler: CsvImportHandler): Promise<void> {
    const channel = await this.connection.channelReady();
    await channel.prefetch(1);

    await channel.consume(CSV_IMPORT_QUEUE, async (message: ConsumeMessage | null) => {
      if (!message) return;

      let payload: CsvImportMessage;
      try {
        payload = JSON.parse(message.content.toString()) as CsvImportMessage;
        if (!payload?.jobId) throw new Error('mensaje sin jobId');
      } catch (error) {
        this.logger.error({ err: error }, 'Mensaje ilegible, va a la DLQ');
        channel.nack(message, false, false);
        return;
      }

      try {
        await handler(payload);
        channel.ack(message);
      } catch (error) {
        this.logger.error({ err: error, jobId: payload.jobId }, 'Fallo procesando el job');
        channel.nack(message, false, false);
      }
    });

    this.logger.info({ queue: CSV_IMPORT_QUEUE }, 'Consumidor escuchando');
  }
}
