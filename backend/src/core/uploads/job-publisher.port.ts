export interface CsvImportMessage {
  jobId: string;
  userId: string;
}

export interface JobPublisher {
  publishCsvImport(message: CsvImportMessage): Promise<void>;
}
