/** Iniciales para el avatar: mismas en la barra superior y en el perfil. */
export function initials(name: string): string {
  const letters = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return letters || '?';
}
