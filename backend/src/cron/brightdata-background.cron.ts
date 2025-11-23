import 'dotenv/config';

import { brightDataBackgroundService } from '../services/data-collection/brightdata-background.service';

const POLL_INTERVAL_MS = Number(process.env.BRIGHTDATA_BACKGROUND_POLL_MS ?? 15 * 60 * 1000); // 15 minutes default
let isRunning = false;

async function runBackgroundCheck(): Promise<void> {
  if (isRunning) {
    console.log('[BrightData Cron] Previous check still running, skipping...');
    return;
  }

  isRunning = true;
  const startTime = new Date();

  try {
    console.log(`[BrightData Cron] Starting background check at ${startTime.toISOString()}`);

    const stats = await brightDataBackgroundService.checkAndCompleteFailedExecutions();

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    console.log(
      `[BrightData Cron] Background check completed in ${duration}ms:`,
      `checked=${stats.checked},`,
      `completed=${stats.completed},`,
      `stillProcessing=${stats.stillProcessing},`,
      `errors=${stats.errors}`,
    );
  } catch (error: any) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[BrightData Cron] Background check failed:`, message);
    console.error(error);
  } finally {
    isRunning = false;
  }
}

console.log(
  `[BrightData Cron] BrightData background cron started. Running every ${POLL_INTERVAL_MS / 1000 / 60} minutes`,
);

// Run immediately on startup
void runBackgroundCheck();

// Then run on interval
setInterval(() => {
  void runBackgroundCheck();
}, POLL_INTERVAL_MS);

