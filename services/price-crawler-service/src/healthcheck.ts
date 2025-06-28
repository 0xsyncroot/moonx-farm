// Healthcheck - Khung module kiểm tra trạng thái service
// Triển khai chi tiết ở giai đoạn sau

export class Healthcheck {
  // Kiểm tra trạng thái kết nối DB, Kafka, các thành phần chính
  async check(): Promise<{ status: string; details?: any }> {
    // TODO: Kiểm tra health các thành phần
    return { status: "unknown" };
  }
}
