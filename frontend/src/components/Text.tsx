import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

/**
 * Tipografia de la app.
 *
 * No se usa el `Typography` de HeroUI a propósito: internamente es el `Text` de
 * react-aria, pensado para descripciones y errores de un campo de formulario, y
 * lanza "A slot prop is required" en cuanto se usa dentro de cualquier campo.
 * Aquí solo hacen falta las escalas de texto, así que se resuelven con los
 * tokens de tema de HeroUI y HTML semantico.
 */
const TITLE_STYLES = {
  h1: 'text-4xl font-semibold tracking-tight sm:text-5xl',
  h2: 'text-3xl font-semibold tracking-tight',
  h3: 'text-2xl font-semibold tracking-tight',
  h4: 'text-xl font-semibold',
  h5: 'text-lg font-semibold',
} as const;

type TitleLevel = keyof typeof TITLE_STYLES;

interface TitleProps extends ComponentPropsWithoutRef<'h1'> {
  level?: TitleLevel;
  as?: ElementType;
  children: ReactNode;
}

export function Title({ level = 'h3', as, className = '', children, ...rest }: TitleProps) {
  const Tag = (as ?? level) as ElementType;
  return (
    <Tag className={`${TITLE_STYLES[level]} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

const TEXT_SIZES = {
  base: 'text-base',
  sm: 'text-sm',
  xs: 'text-xs',
} as const;

interface TextProps extends ComponentPropsWithoutRef<'p'> {
  size?: keyof typeof TEXT_SIZES;
  tone?: 'default' | 'muted';
  as?: ElementType;
  children: ReactNode;
}

export function Text({
  size = 'base',
  tone = 'default',
  as,
  className = '',
  children,
  ...rest
}: TextProps) {
  const Tag = (as ?? 'p') as ElementType;
  const toneClass = tone === 'muted' ? 'text-muted' : 'text-foreground';
  return (
    <Tag className={`${TEXT_SIZES[size]} ${toneClass} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
