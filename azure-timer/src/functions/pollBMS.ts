import { app, InvocationContext, Timer } from '@azure/functions';

// Runs every 4 minutes
app.timer('pollBMS', {
  schedule: '0 */4 * * * *',
  handler: async (timer: Timer, context: InvocationContext) => {
    const cronUrl = process.env.BMS_TRACKER_CRON_URL;
    if (!cronUrl) {
      context.error('BMS_TRACKER_CRON_URL is not configured');
      return;
    }

    context.log(`BMS poll triggered at ${new Date().toISOString()}`);

    try {
      const response = await fetch(cronUrl);
      const data = await response.json();
      context.log(`Cron response: ${JSON.stringify(data)}`);
    } catch (error) {
      context.error(`Failed to call cron endpoint: ${error}`);
    }
  },
});
