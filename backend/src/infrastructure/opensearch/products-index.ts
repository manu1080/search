/**
 * Definicion del indice de productos. El analizador castellano con
 * asciifolding hace que "móvil" encuentre "móvil" y "camisas" encuentre
 * "camisa", que es lo que espera cualquiera escribiendo en la barra.
 */
export const productsIndexDefinition = {
  settings: {
    index: {
      number_of_shards: 1,
      number_of_replicas: 0,
      max_result_window: 10_000,
    },
    analysis: {
      filter: {
        es_stop: { type: 'stop', stopwords: '_spanish_' },
        es_stemmer: { type: 'stemmer', language: 'light_spanish' },
      },
      analyzer: {
        es_text: {
          type: 'custom',
          tokenizer: 'standard',
          filter: ['lowercase', 'asciifolding', 'es_stop', 'es_stemmer'],
        },
      },
    },
  },
  mappings: {
    dynamic: 'strict',
    properties: {
      sku: { type: 'keyword' },
      name: {
        type: 'text',
        analyzer: 'es_text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      description: { type: 'text', analyzer: 'es_text' },
      brand: {
        type: 'text',
        analyzer: 'es_text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      category: {
        type: 'text',
        analyzer: 'es_text',
        fields: { keyword: { type: 'keyword', ignore_above: 256 } },
      },
      price: { type: 'double' },
      currency: { type: 'keyword' },
      stock: { type: 'integer' },
      rating: { type: 'float' },
      imageUrl: { type: 'keyword', index: false },
      tags: { type: 'keyword' },
      indexedAt: { type: 'date' },
    },
  },
} as const;
