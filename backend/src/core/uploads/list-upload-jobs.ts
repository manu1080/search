import { ForbiddenError, NotFoundError } from '../shared/errors.js';
import type { UploadJob } from './upload-job.js';
import type { UploadJobRepository } from './upload-job-repository.port.js';

export class ListUploadJobs {
  constructor(private readonly jobs: UploadJobRepository) {}

  execute(userId: string, limit = 25): Promise<UploadJob[]> {
    return this.jobs.listByUser(userId, Math.min(Math.max(1, limit), 100));
  }
}

export class GetUploadJob {
  constructor(private readonly jobs: UploadJobRepository) {}

  async execute(jobId: string, userId: string): Promise<UploadJob> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new NotFoundError('Job');
    if (job.userId !== userId) throw new ForbiddenError('Ese job pertenece a otro usuario');
    return job;
  }
}
