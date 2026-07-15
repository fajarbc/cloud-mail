import orm from '../entity/orm';
import email from '../entity/email';
import account from '../entity/account';
import settingService from './setting-service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
import { and, eq, sql } from 'drizzle-orm';
import KvConst from '../const/kv-const';
import { isDel } from '../const/entity-const';
import jwtUtils from '../utils/jwt-utils';
import emailMsgTemplate from '../template/email-msg';
import emailTextTemplate from '../template/email-text';
import emailHtmlTemplate from '../template/email-html';
import verifyUtils from '../utils/verify-utils';
import domainUtils from "../utils/domain-uitls";

const telegramService = {

	async getEmailContent(c, params) {

		const { token } = params

		const result = await jwtUtils.verifyToken(c, token);

		if (!result) {
			return emailTextTemplate('Access denied')
		}

		const emailRow = await orm(c).select().from(email).where(eq(email.emailId, result.emailId)).get();

		if (emailRow) {

			if (emailRow.content) {
				const { r2Domain } = await settingService.query(c);
				return emailHtmlTemplate(emailRow.content || '', r2Domain)
			} else {
				return emailTextTemplate(emailRow.text || '')
			}

		} else {
			return emailTextTemplate('The email does not exist')
		}

	},

	async sendEmailToBot(c, email) {

		const { tgBotToken, tgChatId, customDomain, tgMsgTo, tgMsgFrom, tgMsgText } = await settingService.query(c);

		let targetTgChatId = tgChatId;
		if (email.accountId) {
			const accountRow = await orm(c).select().from(account).where(eq(account.accountId, email.accountId)).get();
			if (accountRow && accountRow.tgChatId && accountRow.tgChatId.trim()) {
				targetTgChatId = accountRow.tgChatId.trim();
			}
		}

		if (!targetTgChatId) {
			return;
		}

		const tgChatIds = targetTgChatId.split(',');

		const jwtToken = await jwtUtils.generateToken(c, { emailId: email.emailId })

		const webAppUrl = customDomain ? `${domainUtils.toOssDomain(customDomain)}/api/telegram/getEmail/${jwtToken}` : 'https://www.cloudflare.com/404'
		const inlineKeyboard = [
			[
				{
					text: 'View',
					web_app: { url: webAppUrl }
				}
			]
		];

		if (email.code) {
			inlineKeyboard.push([
				{
					text: email.code,
					copy_text: { text: email.code }
				}
			]);
		}

		await Promise.all(tgChatIds.map(async chatId => {
			try {
				const res = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						chat_id: chatId,
						parse_mode: 'HTML',
						text: emailMsgTemplate(email, tgMsgTo, tgMsgFrom, tgMsgText),
						reply_markup: {
							inline_keyboard: inlineKeyboard
						}
					})
				});
				if (!res.ok) {
					console.error(`转发 Telegram 失败 status: ${res.status} response: ${await res.text()}`);
				}
			} catch (e) {
				console.error(`转发 Telegram 失败:`, e.message);
			}
		}));

	},

	async handleWebhook(c, payload) {

		const setting = await settingService.query(c);
		const { tgBotToken } = setting;

		if (!tgBotToken) {
			return;
		}

		const message = payload?.message;

		if (!message || !message.text || !message.chat) {
			return;
		}

		const text = message.text.trim();
		const chatId = `${message.chat.id}`;
		const [command, ...args] = text.split(/\s+/);
		const normalizedCommand = command.split('@')[0].toLowerCase();

		let replyText = '';

		if (normalizedCommand === '/start' || normalizedCommand === '/help') {
			replyText = `Your Telegram ID:\n<code>${chatId}</code>\n\nCommands:\n/list - list linked email addresses\n/link user@mail.com link_code - link this chat\n/unlink user@mail.com - unlink this chat`;
		} else if (normalizedCommand === '/list') {
			replyText = await this.listLinkedAccounts(c, chatId);
		} else if (normalizedCommand === '/link') {
			replyText = await this.linkAccount(c, setting, chatId, args);
		} else if (normalizedCommand === '/unlink') {
			replyText = await this.unlinkAccount(c, chatId, args);
		} else {
			return;
		}

		await this.reply(c, tgBotToken, chatId, replyText);

	},

	async listLinkedAccounts(c, chatId) {
		const rows = await orm(c).select().from(account).where(and(eq(account.isDel, isDel.NORMAL), sql`${account.tgChatId} != ''`)).all();
		const linkedRows = rows.filter(row => this.parseChatIds(row.tgChatId).includes(chatId));
		if (linkedRows.length === 0) {
			return 'No email address is linked to this Telegram chat.';
		}
		return `Linked email addresses:\n${linkedRows.map(row => `- ${this.escapeHtml(row.email)}`).join('\n')}`;
	},

	async linkAccount(c, setting, chatId, args) {
		if (setting.tgLink !== 0) {
			return 'Telegram linking is disabled by the administrator.';
		}
		const limited = await this.isLinkRateLimited(c, chatId);
		if (limited) {
			return 'Too many link attempts. Please try again later.';
		}
		const [emailArg, linkCodeArg] = args;
		const emailValue = (emailArg || '').trim();
		const linkCode = (linkCodeArg || '').trim().toLowerCase();
		if (!verifyUtils.isEmail(emailValue) || !/^[0-9a-f]{8}$/.test(linkCode)) {
			return 'Usage: /link user@mail.com link_code';
		}
		const accountRow = await orm(c).select().from(account).where(and(sql`${account.email} COLLATE NOCASE = ${emailValue}`, eq(account.linkCode, linkCode), eq(account.isDel, isDel.NORMAL))).get();
		if (!accountRow) {
			return 'Invalid email or link code.';
		}
		const chatIds = this.parseChatIds(accountRow.tgChatId);
		if (!chatIds.includes(chatId)) {
			chatIds.push(chatId);
			await orm(c).update(account).set({tgChatId: chatIds.join(',')}).where(eq(account.accountId, accountRow.accountId)).run();
		}
		return `Linked ${this.escapeHtml(accountRow.email)}.`;
	},

	async unlinkAccount(c, chatId, args) {
		const [emailArg] = args;
		const emailValue = (emailArg || '').trim();
		if (!verifyUtils.isEmail(emailValue)) {
			return 'Usage: /unlink user@mail.com';
		}
		const accountRow = await orm(c).select().from(account).where(and(sql`${account.email} COLLATE NOCASE = ${emailValue}`, eq(account.isDel, isDel.NORMAL))).get();
		if (!accountRow) {
			return 'Email address not found.';
		}
		const chatIds = this.parseChatIds(accountRow.tgChatId).filter(id => id !== chatId);
		if (chatIds.length === this.parseChatIds(accountRow.tgChatId).length) {
			return `This chat is not linked to ${this.escapeHtml(accountRow.email)}.`;
		}
		await orm(c).update(account).set({tgChatId: chatIds.join(',')}).where(eq(account.accountId, accountRow.accountId)).run();
		return `Unlinked ${this.escapeHtml(accountRow.email)}.`;
	},

	async isLinkRateLimited(c, chatId) {
		const minuteKey = `${KvConst.TG_LINK_RATE}${chatId}:minute`;
		const dayKey = `${KvConst.TG_LINK_RATE}${chatId}:day:${dayjs().tz('Asia/Shanghai').format('YYYY-MM-DD')}`;
		const [minuteCount, dayCount] = await Promise.all([
			c.env.kv.get(minuteKey),
			c.env.kv.get(dayKey)
		]);
		if (Number(minuteCount || 0) >= 10 || Number(dayCount || 0) >= 100) {
			return true;
		}
		await Promise.all([
			c.env.kv.put(minuteKey, `${Number(minuteCount || 0) + 1}`, { expirationTtl: 60 }),
			c.env.kv.put(dayKey, `${Number(dayCount || 0) + 1}`, { expirationTtl: 86400 })
		]);
		return false;
	},

	parseChatIds(value) {
		return (value || '').split(',').map(item => item.trim()).filter(Boolean);
	},

	escapeHtml(value) {
		return `${value || ''}`.replace(/[&<>"]/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[char]));
	},

	async reply(c, tgBotToken, chatId, text) {
		try {
			await fetch(`https://api.telegram.org/bot${tgBotToken}/sendMessage`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					chat_id: chatId,
					parse_mode: 'HTML',
					text
				})
			});
		} catch (e) {
			console.error(`Telegram webhook reply failed:`, e.message);
		}
	}

}

export default telegramService
