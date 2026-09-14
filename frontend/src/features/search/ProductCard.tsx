import { Card, Chip } from '@heroui/react';
import { useState } from 'react';
import { formatPrice } from '../../lib/format';
import type { Product } from '../../lib/types';
import { Text, Title } from '../../components/Text';

/** Los fragmentos resaltados llegan de OpenSearch ya escapados salvo <mark>. */

function Highlighted({ html, fallback }: { html?: string; fallback: string }) {
  if (!html) return <>{fallback}</>;
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ProductCard({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = product.imageUrl && !imageFailed;
  return (
    <Card className="group h-full overflow-hidden transition-shadow hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-surface-secondary">
        {showImage ? (
          <img
            src={product.imageUrl ?? ''}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid size-full place-items-center text-muted">
            <svg
              viewBox="0 0 24 24"
              className="size-10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          </div>
        )}
        {product.stock === 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-danger px-2 py-0.5 text-xs font-medium text-danger-foreground">
            Sin stock
          </span>
        )}
      </div>
      <Card.Content className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <Text size="xs" tone="muted" className="uppercase tracking-wide">
            {product.brand}
          </Text>
          <span className="flex items-center gap-1 text-xs text-muted">
            <svg viewBox="0 0 24 24" className="size-3.5 fill-warning text-warning" stroke="none">
              <path d="m12 2 3 6.5 7 .9-5 4.8 1.2 7L12 17.8 5.8 21.2 7 14.2 2 9.4l7-.9L12 2Z" />
            </svg>
            {product.rating.toFixed(1)}
          </span>
        </div>
        <Text className="font-semibold line-clamp-2">
          <Highlighted html={product.highlight?.name} fallback={product.name} />
        </Text>
        <Text size="sm" tone="muted" className="line-clamp-2">
          <Highlighted html={product.highlight?.description} fallback={product.description} />
        </Text>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <Title level="h5">{formatPrice(product.price, product.currency)}</Title>
          <Chip size="sm" variant="soft" color={product.stock > 0 ? 'success' : 'default'}>
            <Chip.Label>{product.stock > 0 ? `${product.stock} uds.` : 'Agotado'}</Chip.Label>
          </Chip>
        </div>
      </Card.Content>
    </Card>
  );
}
