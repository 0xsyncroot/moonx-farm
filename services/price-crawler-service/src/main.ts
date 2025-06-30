// Main entrypoint - Khởi động đồng thời Scheduler và Worker để kiểm thử end-to-end

import { Scheduler } from "./scheduler";
import { triggerAllJobsOnStartup } from "./scheduler/trigger_on_startup";
import { Worker } from "./worker";

async function main() {
  const scheduler = new Scheduler();
  const worker = new Worker();

  // Khởi động worker trước để đảm bảo đã subscribe topic
  await worker.start();

  // Khởi động scheduler để gửi job lên Kafka
  await scheduler.init();

  // Chạy tất cả các job ngay lập tức khi start app
  await triggerAllJobsOnStartup();

  console.log("[Main] Scheduler and Worker started for end-to-end test.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[Main] Error:", err);
});
