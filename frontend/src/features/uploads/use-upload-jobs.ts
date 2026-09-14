import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api-client';
import type { UploadJob } from '../../lib/types';

const POLL_MS = 2000;

function isPending(job: UploadJob): boolean {
  return job.status === 'PENDING' || job.status === 'PROCESSING';
}

/**
 * Lista de importaciones del usuario. Mientras haya alguna en curso se refresca
 * cada 2 s; en cuanto todas terminan el sondeo se detiene solo.
 */
export function useUploadJobs() {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const { jobs: fresh } = await api.listJobs();
    setJobs(fresh);
    setLoading(false);
    return fresh;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      try {
        const fresh = await refresh();
        if (cancelled) return;
        if (fresh.some(isPending)) timer.current = setTimeout(tick, POLL_MS);
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    void tick();

    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh]);

  /** Tras subir un fichero se reactiva el sondeo sin esperar al siguiente ciclo. */
  const track = useCallback(
    async (job: UploadJob) => {
      setJobs((current) => [job, ...current]);
      if (timer.current) clearTimeout(timer.current);

      const poll = async () => {
        const fresh = await refresh().catch(() => [] as UploadJob[]);
        if (fresh.some(isPending)) timer.current = setTimeout(poll, POLL_MS);
      };
      timer.current = setTimeout(poll, POLL_MS);
    },
    [refresh],
  );

  return { jobs, loading, track, refresh };
}
