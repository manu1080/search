import { Button, Tooltip } from '@heroui/react';
import { useTheme } from '../lib/use-theme';

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
    <path
      d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SunIcon = () => (
  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="4" />
    <path
      d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      strokeLinecap="round"
    />
  </svg>
);

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro';

  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Button variant="ghost" size="sm" isIconOnly aria-label={label} onPress={toggle}>
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content>{label}</Tooltip.Content>
    </Tooltip>
  );
}
