/**
 * Railway deployment helper.
 *
 * Usage (after Railway deploys your app):
 *   npx ts-node scripts/deploy-railway.ts
 *
 * Requires in .env or Railway variables:
 *   APP_ORIGIN     – your Railway app URL (e.g. https://quiz-bot.up.railway.app)
 *   TELEGRAM_BOT_TOKEN
 *   TELEGRAM_WEBHOOK_SECRET
 *   BALE_BOT_TOKEN        (optional)
 */
import 'dotenv/config';
import axios from 'axios';

async function setTelegramWebhook(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const origin = process.env.APP_ORIGIN?.replace(/\/$/, '');
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
  if (!origin) throw new Error('APP_ORIGIN is required (e.g. https://your-app.up.railway.app)');

  const webhookUrl = `${origin}/webhook/telegram`;
  const api = `https://api.telegram.org/bot${token}`;

  const body: Record<string, string> = { url: webhookUrl };
  if (secret) body.secret_token = secret;

  const { data } = await axios.post(`${api}/setWebhook`, body);
  console.log('Telegram webhook:', JSON.stringify(data, null, 2));

  const info = await axios.get(`${api}/getWebhookInfo`);
  console.log('Telegram webhook info:', JSON.stringify(info.data.result, null, 2));
}

async function setBaleWebhook(): Promise<void> {
  const token = process.env.BALE_BOT_TOKEN;
  if (!token) {
    console.log('BALE_BOT_TOKEN not set, skipping Bale webhook');
    return;
  }

  const origin = process.env.APP_ORIGIN?.replace(/\/$/, '');
  if (!origin) throw new Error('APP_ORIGIN is required');

  const webhookUrl = `${origin}/webhook/bale`;
  const api = `https://tapi.bale.ai/bot${token}`;

  const { data } = await axios.post(`${api}/setWebhook`, { url: webhookUrl });
  console.log('Bale webhook:', JSON.stringify(data, null, 2));
}

async function main(): Promise<void> {
  console.log('Registering webhooks for Railway deployment...\n');

  try {
    await setTelegramWebhook();
  } catch (err: any) {
    console.error('Telegram webhook failed:', err.message);
  }

  console.log('');

  try {
    await setBaleWebhook();
  } catch (err: any) {
    console.error('Bale webhook failed:', err.message);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
