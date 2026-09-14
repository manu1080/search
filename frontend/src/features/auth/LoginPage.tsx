import { Button, Card, Input, Label, TextField } from '@heroui/react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { StatusMessage } from '../../components/StatusMessage';
import { ApiError } from '../../lib/api-client';
import { useAuth } from './auth-context';
import { Text } from '../../components/Text';

export function LoginPage() {
  const { login, status } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('demo@search.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ProtectedRoute deja aqui la ruta que se intentaba abrir.
  const destination = (location.state as { from?: string } | null)?.from ?? '/perfil';

  // Una sola salida: en cuanto hay sesion se navega al destino. Si ademas se
  // navegase desde handleSubmit, las dos redirecciones competirian y ganaria
  // la de este guard, perdiendo la ruta que el usuario habia pedido.
  if (status === 'authenticated') return <Navigate to={destination} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No se ha podido iniciar sesión');
      setSubmitting(false);
    }
  }
  return (
    <div className="mx-auto max-w-md py-8">
      <Card>
        <Card.Header>
          <Card.Title>Iniciar sesión</Card.Title>
          <Card.Description>Accede para subir catálogos y editar tu perfil.</Card.Description>
        </Card.Header>
        <Card.Content>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <TextField value={email} onChange={setEmail} type="email" isRequired autoFocus>
              <Label>Email</Label>
              <Input placeholder="tu@email.com" />
            </TextField>
            <TextField value={password} onChange={setPassword} type="password" isRequired>
              <Label>Contraseña</Label>
              <Input placeholder="••••••••" />
            </TextField>
            {error && <StatusMessage tone="danger">{error}</StatusMessage>}
            <Button type="submit" variant="primary" fullWidth isPending={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
        </Card.Content>
        <Card.Footer className="flex-col items-start gap-2">
          <Text size="sm" tone="muted">
            ¿No tienes cuenta?{' '}
            <Link to="/registro" className="text-link underline underline-offset-2">
              Crear una
            </Link>
          </Text>
          <Text size="xs" tone="muted">
            Demo: demo@search.local / Demo1234!
          </Text>
        </Card.Footer>
      </Card>
    </div>
  );
}
