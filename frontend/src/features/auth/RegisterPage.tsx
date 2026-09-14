import { Button, Card, Input, Label, TextField } from '@heroui/react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router';
import { StatusMessage } from '../../components/StatusMessage';
import { ApiError } from '../../lib/api-client';
import { useAuth } from './auth-context';
import { Text } from '../../components/Text';

export function RegisterPage() {
  const { register, status } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  if (status === 'authenticated') return <Navigate to="/perfil" replace />;
  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    setSubmitting(true);
    try {
      await register(name, email, password);
      // El guard de arriba redirige en cuanto hay sesion.
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se ha podido crear la cuenta');
      setSubmitting(false);
    }
  }
  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <Card.Header>
          <Card.Title>Crear cuenta</Card.Title>
          <Card.Description>Necesaria solo para subir catálogos; buscar es libre.</Card.Description>
        </Card.Header>
        <Card.Content>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <TextField value={name} onChange={setName} isRequired autoFocus>
              <Label>Nombre</Label>
              <Input placeholder="Tu nombre" />
            </TextField>
            <TextField value={email} onChange={setEmail} type="email" isRequired>
              <Label>Email</Label>
              <Input placeholder="tu@email.com" />
            </TextField>
            <TextField value={password} onChange={setPassword} type="password" isRequired>
              <Label>Contraseña</Label>
              <Input placeholder="Mínimo 8 caracteres" />
            </TextField>
            {error && <StatusMessage tone="danger">{error}</StatusMessage>}
            <Button type="submit" variant="primary" fullWidth isPending={submitting}>
              {submitting ? 'Creando…' : 'Crear cuenta'}
            </Button>
          </form>
        </Card.Content>
        <Card.Footer>
          <Text size="sm" tone="muted">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-link underline underline-offset-2">
              Entrar
            </Link>
          </Text>
        </Card.Footer>
      </Card>
    </div>
  );
}
