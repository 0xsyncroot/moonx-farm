// Models - Định nghĩa kiểu dữ liệu, enums, constants dùng chung
// Triển khai chi tiết ở giai đoạn sau

export enum JobType {
  PRICE = "price",
  METADATA = "metadata",
  AUDIT = "audit",
}

export enum TokenType {
  TOP100 = "top100",
  TRENDING = "trending",
}

export enum KafkaTopic {
  PRICE_REQUEST = "price-crawler.price.request",
  METADATA_REQUEST = "price-crawler.metadata.request",
  AUDIT_REQUEST = "price-crawler.audit.request",
}
