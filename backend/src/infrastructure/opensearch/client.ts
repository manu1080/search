import { Client } from '@opensearch-project/opensearch';

let client: Client | undefined;

export function opensearch(node: string): Client {
  client ??= new Client({ node, requestTimeout: 15_000 });
  return client;
}

export async function closeOpensearch(): Promise<void> {
  await client?.close();
  client = undefined;
}
