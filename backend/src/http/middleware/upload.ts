import multer from 'multer';
import { ValidationError } from '../../core/shared/errors.js';

/**
 * El CSV se recibe en memoria y lo persiste el caso de uso a traves del puerto
 * FileStorage: así el dominio no depende de como llega el fichero.
 */
export function csvUpload(maxBytes: number) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, callback) => {
      const isCsv =
        file.originalname.toLowerCase().endsWith('.csv') ||
        ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'].includes(
          file.mimetype,
        );
      if (!isCsv) {
        callback(new ValidationError('Solo se aceptan ficheros CSV'));
        return;
      }
      callback(null, true);
    },
  }).single('file');
}
