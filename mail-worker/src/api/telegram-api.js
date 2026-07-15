import app from '../hono/hono';
import telegramService from '../service/telegram-service';

app.get('/telegram/getEmail/:token', async (c) => {
	const content = await telegramService.getEmailContent(c, c.req.param());
	c.header('Cache-Control', 'public, max-age=604800, immutable');
	return c.html(content)
});

app.post('/telegram/webhook', async (c) => {
	const payload = await c.req.json().catch(() => null);
	if (payload) {
		await telegramService.handleWebhook(c, payload);
	}
	return c.json({ ok: true });
});

