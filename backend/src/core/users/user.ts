export interface User {
  id: string;
  email: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Usuario tal y como se persiste, con el hash de la contraseña. */
export interface UserWithCredentials extends User {
  passwordHash: string;
}

/** Vista pública del usuario: nunca expone el hash fuera del dominio. */
export function toPublicUser(user: UserWithCredentials | User): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
