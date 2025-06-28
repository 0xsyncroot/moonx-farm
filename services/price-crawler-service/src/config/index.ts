// Config - Khung module cấu hình hệ thống (env, kafka, db, scheduler, ...)
// Triển khai chi tiết ở giai đoạn sau

export interface AppConfig {
  kafkaBrokers: string[];
  dbUrl: string;
  scheduler: {
    priceCron: string;
    metadataCron: string;
    auditCron: string;
  };
  [key: string]: any;
}

export class Config {
  static load(): AppConfig {
    // TODO: Đọc cấu hình từ env/file
    return {
      kafkaBrokers: [],
      dbUrl: "",
      scheduler: {
        priceCron: "",
        metadataCron: "",
        auditCron: "",
      },
    };
  }
}
