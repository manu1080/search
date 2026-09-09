import { Chip, ProgressBar, Skeleton, Table } from '@heroui/react';
import { formatBytes, formatDate } from '../../lib/format';
import type { UploadJob, UploadJobStatus } from '../../lib/types';
import { Text } from '../../components/Text';

const STATUS_META: Record<
  UploadJobStatus,
  { label: string; color: 'default' | 'accent' | 'success' | 'danger' }
> = {
  PENDING: { label: 'En cola', color: 'default' },
  PROCESSING: { label: 'Procesando', color: 'accent' },
  COMPLETED: { label: 'Completado', color: 'success' },
  FAILED: { label: 'Fallido', color: 'danger' },
};

export function JobsTable({ jobs, loading }: { jobs: UploadJob[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-12 text-center">
        <Text size="sm" tone="muted">
          Todavia no has subido ningun catálogo.
        </Text>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <Table.ScrollContainer>
          <Table.Content aria-label="Importaciones de catálogo">
            <Table.Header>
              <Table.Column isRowHeader>Fichero</Table.Column>
              <Table.Column>Estado</Table.Column>
              <Table.Column>Filas</Table.Column>
              <Table.Column>Subido</Table.Column>
            </Table.Header>
            <Table.Body>
              {jobs.map((job) => {
                const meta = STATUS_META[job.status];
                const progress =
                  job.rowsTotal > 0 ? Math.round((job.rowsIndexed / job.rowsTotal) * 100) : 0;
                return (
                  <Table.Row key={job.id}>
                    <Table.Cell>
                      <div className="flex flex-col">
                        <span className="font-medium">{job.originalName}</span>
                        <span className="text-xs text-muted">{formatBytes(job.sizeBytes)}</span>
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <div className="flex flex-col gap-1">
                        <Chip size="sm" variant="soft" color={meta.color}>
                          <Chip.Label>{meta.label}</Chip.Label>
                        </Chip>
                        {job.status === 'PROCESSING' && (
                          <ProgressBar
                            value={progress}
                            aria-label="Progreso de la importación"
                            className="w-28"
                          >
                            <ProgressBar.Track>
                              <ProgressBar.Fill />
                            </ProgressBar.Track>
                          </ProgressBar>
                        )}
                      </div>
                    </Table.Cell>
                    <Table.Cell>
                      <span className="tabular-nums">
                        {job.rowsIndexed} / {job.rowsTotal}
                      </span>
                      {job.rowsFailed > 0 && (
                        <span className="ml-2 text-xs text-danger">{job.rowsFailed} con error</span>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      <span className="text-sm text-muted">{formatDate(job.createdAt)}</span>
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </Table>
      {jobs
        .filter((job) => job.errors.length > 0 || job.errorMessage)
        .map((job) => (
          <details
            key={job.id}
            className="rounded-lg border border-border bg-surface-secondary p-3"
          >
            <summary className="cursor-pointer text-sm font-medium">
              Errores de {job.originalName} ({job.rowsFailed})
            </summary>
            <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
              {job.errorMessage && <li className="text-danger">{job.errorMessage}</li>}
              {job.errors.map((error, index) => (
                <li key={`${job.id}-${index}`}>
                  {error.line > 0 && (
                    <span className="font-mono text-xs">línea {error.line}: </span>
                  )}
                  {error.message}
                </li>
              ))}
            </ul>
          </details>
        ))}
    </div>
  );
}
