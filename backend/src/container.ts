import { env } from './config/env.js';
import { LoginUser } from './core/auth/login-user.js';
import { RegisterUser } from './core/auth/register-user.js';
import { SearchProducts, SuggestProducts } from './core/products/search-products.js';
import { systemClock } from './core/shared/clock.js';
import { uuidGenerator } from './core/shared/id-generator.js';
import { ChangePassword, GetProfile, UpdateProfile } from './core/users/update-profile.js';
import { CreateUploadJob } from './core/uploads/create-upload-job.js';
import { GetUploadJob, ListUploadJobs } from './core/uploads/list-upload-jobs.js';
import { ProcessUploadJob } from './core/uploads/process-upload-job.js';
import { CsvProductParserAdapter } from './infrastructure/csv/csv-product.parser.js';
import { prisma } from './infrastructure/db/prisma.js';
import { PrismaUploadJobRepository } from './infrastructure/db/prisma-upload-job.repository.js';
import { PrismaUserRepository } from './infrastructure/db/prisma-user.repository.js';
import { opensearch } from './infrastructure/opensearch/client.js';
import { OpensearchProductIndexRepository } from './infrastructure/opensearch/opensearch-product-index.repository.js';
import { OpensearchProductSearchRepository } from './infrastructure/opensearch/opensearch-product-search.repository.js';
import { AmqpCsvImportConsumer } from './infrastructure/rabbitmq/amqp-consumer.js';
import { AmqpJobPublisher } from './infrastructure/rabbitmq/amqp-job.publisher.js';
import { RabbitConnection } from './infrastructure/rabbitmq/connection.js';
import { BcryptPasswordHasher } from './infrastructure/security/bcrypt-password-hasher.js';
import { JwtTokenIssuer } from './infrastructure/security/jwt-token-issuer.js';
import { LocalFileStorage } from './infrastructure/storage/local-file.storage.js';
import { createLogger } from './infrastructure/logger.js';

/**
 * Composition root: el único sitio donde se eligen implementaciones concretas.
 * Todo lo demas depende de interfaces, lo que mantiene el dominio testeable.
 */
export function buildContainer(loggerName: string) {
  const config = env();
  const logger = createLogger(loggerName);

  const db = prisma();
  const searchClient = opensearch(config.OPENSEARCH_URL);
  const rabbit = new RabbitConnection(config.RABBITMQ_URL);

  const users = new PrismaUserRepository(db);
  const jobs = new PrismaUploadJobRepository(db);
  const storage = new LocalFileStorage(config.UPLOAD_DIR);
  const hasher = new BcryptPasswordHasher();
  const tokens = new JwtTokenIssuer(config.JWT_SECRET, config.JWT_EXPIRES_IN);
  const productSearch = new OpensearchProductSearchRepository(
    searchClient,
    config.OPENSEARCH_PRODUCTS_INDEX,
  );
  const productIndex = new OpensearchProductIndexRepository(
    searchClient,
    config.OPENSEARCH_PRODUCTS_INDEX,
  );
  const parser = new CsvProductParserAdapter();
  const publisher = new AmqpJobPublisher(rabbit);

  return {
    config,
    logger,
    db,
    rabbit,
    searchClient,
    productIndex,
    useCases: {
      registerUser: new RegisterUser(users, hasher, tokens),
      loginUser: new LoginUser(users, hasher, tokens),
      getProfile: new GetProfile(users),
      updateProfile: new UpdateProfile(users),
      changePassword: new ChangePassword(users, hasher),
      searchProducts: new SearchProducts(productSearch),
      suggestProducts: new SuggestProducts(productSearch),
      createUploadJob: new CreateUploadJob(jobs, storage, publisher, uuidGenerator),
      listUploadJobs: new ListUploadJobs(jobs),
      getUploadJob: new GetUploadJob(jobs),
      processUploadJob: new ProcessUploadJob(jobs, storage, parser, productIndex, systemClock),
    },
    tokens,
    consumer: () => new AmqpCsvImportConsumer(rabbit, logger),
  };
}

export type Container = ReturnType<typeof buildContainer>;
