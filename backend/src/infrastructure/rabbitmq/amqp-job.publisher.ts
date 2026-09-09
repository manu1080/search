import type { CsvImportMessage, JobPublisher } from '../../core/uploads/job-publisher.port.js';
import type { RabbitConnection } from './connection.js';
import { CSV_IMPORT_ROUTING_KEY, EXCHANGE } from './topology.js';

export class AmqpJobPublisher implements JobPublisher {
  constructor(private readonly connection: RabbitConnection) {}

  async publishCsvImport(message: CsvImportMessage): Promise<void> {
    const channel = await this.connection.channelReady();
    const payload = Buffer.from(JSON.stringify(message));

    const accepted = channel.publish(EXCHANGE, CSV_IMPORT_ROUTING_KEY, payload, {
      persistent: true,
      contentType: 'application/json',
      messageId: message.jobId,
    });

    if (!accepted) {
      // El buffer interno esta lleno: esperamos a que se drene antes de seguir.
      await new Promise<void>((resolve) => channel.once('drain', resolve));
    }
  }
}
