import { Card } from '@heroui/react';
import { useState } from 'react';
import { StatusMessage } from '../../components/StatusMessage';
import { api, ApiError } from '../../lib/api-client';
import { CsvDropzone } from './CsvDropzone';
import { JobsTable } from './JobsTable';
import { useUploadJobs } from './use-upload-jobs';
import { Text, Title } from '../../components/Text';

const CSV_HEADER = 'sku,name,description,brand,category,price,currency,stock,rating,imageUrl,tags';

export function UploadPage() {
  const { jobs, loading, track } = useUploadJobs();
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'danger' | 'success'; message: string } | null>(
    null,
  );
  async function handleFile(file: File) {
    setFeedback(null);
    setUploading(true);
    try {
      const { job } = await api.uploadCsv(file);
      await track(job);
      setFeedback({ tone: 'success', message: `"${file.name}" en cola. Se indexará en segundos.` });
    } catch (caught) {
      setFeedback({
        tone: 'danger',
        message: caught instanceof ApiError ? caught.message : 'No se ha podido subir el fichero',
      });
    } finally {
      setUploading(false);
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <header>
        <Title level="h3">Subir catálogo</Title>
        <Text size="sm" tone="muted">
          El fichero se guarda, se encola en RabbitMQ y un worker lo indexa en OpenSearch.
        </Text>
      </header>
      <Card>
        <Card.Content className="flex flex-col gap-4 p-6">
          <CsvDropzone onFile={handleFile} isUploading={uploading} />
          {feedback && <StatusMessage tone={feedback.tone}>{feedback.message}</StatusMessage>}
          <div className="rounded-lg bg-surface-secondary p-3">
            <Text size="xs" tone="muted">
              Columnas esperadas (la primera fila es la cabecera):
            </Text>
            <code className="mt-1 block overflow-x-auto whitespace-nowrap text-xs">
              {CSV_HEADER}
            </code>
          </div>
        </Card.Content>
      </Card>
      <section className="flex flex-col gap-3">
        <Title level="h5">Mis importaciones</Title>
        <JobsTable jobs={jobs} loading={loading} />
      </section>
    </div>
  );
}
