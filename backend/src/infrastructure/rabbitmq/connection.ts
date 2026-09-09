import amqp, { type Channel, type ChannelModel } from 'amqplib';
import { assertTopology } from './topology.js';

/**
 * Conexión perezosa y auto-reparable a RabbitMQ: si el broker se cae, el
 * siguiente uso reabre conexión y canal en lugar de dejar el proceso muerto.
 */
export class RabbitConnection {
  private connection?: ChannelModel;
  private channel?: Channel;
  private connecting?: Promise<Channel>;

  constructor(private readonly url: string) {}

  async channelReady(): Promise<Channel> {
    if (this.channel) return this.channel;
    this.connecting ??= this.open();
    try {
      return await this.connecting;
    } finally {
      this.connecting = undefined;
    }
  }

  private async open(): Promise<Channel> {
    const connection = await amqp.connect(this.url);
    const channel = await connection.createChannel();
    await assertTopology(channel);

    const reset = () => {
      this.connection = undefined;
      this.channel = undefined;
    };
    connection.on('close', reset);
    connection.on('error', reset);
    channel.on('close', reset);
    channel.on('error', reset);

    this.connection = connection;
    this.channel = channel;
    return channel;
  }

  async close(): Promise<void> {
    const connection = this.connection;
    this.channel = undefined;
    this.connection = undefined;
    await connection?.close().catch(() => undefined);
  }
}
