import { Button } from '@heroui/react';
import { useRef, useState, type DragEvent } from 'react';
import { Text } from '../../components/Text';

interface CsvDropzoneProps {
  onFile: (file: File) => void;
  isUploading: boolean;
}

export function CsvDropzone({ onFile, isUploading }: CsvDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }
  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={[
        'flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
        isDragging ? 'border-accent bg-accent-soft' : 'border-border bg-surface-secondary',
      ].join(' ')}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-10 text-muted"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 16V4m0 0L8 8m4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 15v3a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-3" strokeLinecap="round" />
      </svg>
      <div>
        <Text className="font-medium">Arrastra aquí tu CSV de productos</Text>
        <Text size="sm" tone="muted">
          O selecciona el fichero desde tu equipo (máximo 20 MB)
        </Text>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
      <Button variant="primary" isPending={isUploading} onPress={() => inputRef.current?.click()}>
        {isUploading ? 'Subiendo…' : 'Seleccionar fichero'}
      </Button>
    </div>
  );
}
