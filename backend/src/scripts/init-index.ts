import { env } from '../config/env.js';
import { closeOpensearch, opensearch } from '../infrastructure/opensearch/client.js';
import { OpensearchProductIndexRepository } from '../infrastructure/opensearch/opensearch-product-index.repository.js';

const config = env();
const index = new OpensearchProductIndexRepository(
  opensearch(config.OPENSEARCH_URL),
  config.OPENSEARCH_PRODUCTS_INDEX,
);

await index.ensureIndex();
console.log(`Indice "${config.OPENSEARCH_PRODUCTS_INDEX}" listo en ${config.OPENSEARCH_URL}`);
await closeOpensearch();
