import { Avatar, Button, Card, Input, Label, TextArea, TextField } from '@heroui/react';
import { useState, type FormEvent } from 'react';
import { StatusMessage } from '../../components/StatusMessage';
import { useAuth } from '../auth/auth-context';
import { api, ApiError } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { initials } from '../../lib/initials';
import { Text, Title } from '../../components/Text';

export function ProfilePage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [profileState, setProfileState] = useState<FormState>({ kind: 'idle' });
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordState, setPasswordState] = useState<FormState>({ kind: 'idle' });
  if (!user) return null;
  async function handleProfileSubmit(event: FormEvent) {
    event.preventDefault();
    setProfileState({ kind: 'saving' });
    try {
      const { user: updated } = await api.updateProfile({
        name,
        email,
        bio: bio.trim() === '' ? null : bio,
        avatarUrl: avatarUrl.trim() === '' ? null : avatarUrl,
      });
      setUser(updated);
      setProfileState({ kind: 'success', message: 'Perfil actualizado' });
    } catch (caught) {
      setProfileState({ kind: 'error', message: messageOf(caught, 'No se ha podido guardar') });
    }
  }
  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 8) {
      setPasswordState({ kind: 'error', message: 'La nueva contraseña necesita 8 caracteres' });
      return;
    }
    setPasswordState({ kind: 'saving' });
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setPasswordState({ kind: 'success', message: 'Contraseña actualizada' });
    } catch (caught) {
      setPasswordState({ kind: 'error', message: messageOf(caught, 'No se ha podido cambiar') });
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-4">
        <Avatar size="lg">
          {user.avatarUrl && <Avatar.Image src={user.avatarUrl} alt={user.name} />}
          <Avatar.Fallback>{initials(user.name)}</Avatar.Fallback>
        </Avatar>
        <div>
          <Title level="h3">{user.name}</Title>
          <Text size="sm" tone="muted">
            {user.email} · miembro desde {formatDate(user.createdAt)}
          </Text>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Card>
          <Card.Header>
            <Card.Title>Mis datos</Card.Title>
            <Card.Description>Actualiza tu información pública.</Card.Description>
          </Card.Header>
          <Card.Content>
            <form className="flex flex-col gap-4" onSubmit={handleProfileSubmit}>
              <TextField value={name} onChange={setName} isRequired>
                <Label>Nombre</Label>
                <Input />
              </TextField>
              <TextField value={email} onChange={setEmail} type="email" isRequired>
                <Label>Email</Label>
                <Input />
              </TextField>
              <TextField value={bio} onChange={setBio}>
                <Label>Bio</Label>
                <TextArea rows={3} placeholder="Cuenta algo sobre ti" />
              </TextField>
              <TextField value={avatarUrl} onChange={setAvatarUrl} type="url">
                <Label>URL del avatar</Label>
                <Input placeholder="https://…" />
              </TextField>
              {profileState.kind === 'error' && (
                <StatusMessage tone="danger">{profileState.message}</StatusMessage>
              )}
              {profileState.kind === 'success' && (
                <StatusMessage tone="success">{profileState.message}</StatusMessage>
              )}
              <div>
                <Button type="submit" variant="primary" isPending={profileState.kind === 'saving'}>
                  Guardar cambios
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>Contraseña</Card.Title>
            <Card.Description>Cámbiala cuando quieras.</Card.Description>
          </Card.Header>
          <Card.Content>
            <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
              <TextField
                value={currentPassword}
                onChange={setCurrentPassword}
                type="password"
                isRequired
              >
                <Label>Contraseña actual</Label>
                <Input />
              </TextField>
              <TextField value={newPassword} onChange={setNewPassword} type="password" isRequired>
                <Label>Nueva contraseña</Label>
                <Input placeholder="Mínimo 8 caracteres" />
              </TextField>
              {passwordState.kind === 'error' && (
                <StatusMessage tone="danger">{passwordState.message}</StatusMessage>
              )}
              {passwordState.kind === 'success' && (
                <StatusMessage tone="success">{passwordState.message}</StatusMessage>
              )}
              <div>
                <Button
                  type="submit"
                  variant="secondary"
                  isPending={passwordState.kind === 'saving'}
                >
                  Cambiar contraseña
                </Button>
              </div>
            </form>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}

type FormState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}
