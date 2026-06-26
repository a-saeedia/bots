/**
 * Register Telegram webhook after deployment.
 * Usage: npx ts-node scripts/setup-webhook.ts
 * Requires: TELEGRAM_BOT_TOKEN, APP_ORIGIN, TELEGRAM_WEBHOOK_SECRET in .env
 */
import 'dotenv/config';
import axios from 'axios';

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const origin = process.env.APP_ORIGIN?.replace(/\/$/, '');
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');
  if (!origin) throw new Error('APP_ORIGIN is required (e.g. https://your-app.onrender.com)');

  const webhookUrl = `${origin}/webhook/telegram`;
  const api = `https://api.telegram.org/bot${token}`;

  const body: Record<string, string> = { url: webhookUrl };
  if (secret) body.secret_token = secret;

  const { data } = await axios.post(`${api}/setWebhook`, body);
  console.log('Webhook registration:', JSON.stringify(data, null, 2));

  const info = await axios.get(`${api}/getWebhookInfo`);
  console.log('Webhook info:', JSON.stringify(info.data.result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
