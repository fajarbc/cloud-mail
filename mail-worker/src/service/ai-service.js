import emailUtils from '../utils/email-utils';
import { settingConst } from '../const/entity-const';

const systemPrompt = 'You extract verification codes from emails. Return only JSON like {"code":"12345678"} or {"code":""}. The code must be 8 characters or fewer and must not contain spaces. If the code is longer than 8 characters or contains spaces, return {"code":""}. Do not explain.';

const aiService = {
	async extractCode(c, email, options = {}) {
		if (!this.shouldExtractCode(options.aiCode, options.aiCodeFilter, email)) {
			return { code: '', source: 'no' };
		}

		try {
			const subject = email.subject || '';
			const text = emailUtils.formatText(email.text || '');
			const htmlText = emailUtils.htmlToText(email.html || '');
			const body = (htmlText || text).slice(0, 6000);

			if (!subject && !body) {
				return { code: '', source: 'no' };
			}

			const messages = [
				{
					role: 'system',
					content: systemPrompt
				},
				{
					role: 'user',
					content: `Subject: ${subject}\n\n${body}`
				}
			];

			let content = await this.extractWithWorkersAi(c, messages);
			let code = this.parseCode(content);
			let source = code ? 'cf' : 'no';

			if (!code) {
				content = await this.extractWithOpenAiCompatible(c, messages);
				code = this.parseCode(content);
				if (code) {
					source = 'fb';
				}
			}

			return { code: code || '', source: code ? source : 'no' };
		} catch (e) {
			console.error('验证码提取失败: ', e);
			return { code: '', source: 'no' };
		}
	},

	async extractWithWorkersAi(c, messages) {
		const ai = c.env.ai;

		if (!ai) {
			return '';
		}

		try {
			const result = await ai.run(c.env.ai_model || '@cf/meta/llama-3.1-8b-instruct', {
				messages,
				temperature: 0,
				max_tokens: 32
			});

			return typeof result === 'string' ? result : result?.response || '';
		} catch (e) {
			console.error('Cloudflare AI extraction failed: ', e);
			return '';
		}
	},

	async extractWithOpenAiCompatible(c, messages) {
		const apiKey = c.env.ai_fallback_api_key;
		const model = c.env.ai_fallback_model;
		const baseUrl = (c.env.ai_fallback_base_url || '').replace(/\/$/, '');

		if (!apiKey || !model || !baseUrl) {
			return '';
		}

		try {
			const response = await fetch(`${baseUrl}/chat/completions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model,
					messages,
					temperature: 0,
					max_tokens: 32
				})
			});

			if (!response.ok) {
				console.error('Fallback AI extraction failed: ', response.status, await response.text());
				return '';
			}

			const result = await response.json();
			return result?.choices?.[0]?.message?.content || '';
		} catch (e) {
			console.error('Fallback AI extraction failed: ', e);
			return '';
		}
	},

	parseCode(content) {
		try {
			const match = content.match(/\{[\s\S]*\}/);
			const json = JSON.parse(match ? match[0] : content);
			if (typeof json.code !== 'string') {
				return '';
			}

			if (json.code.length > 8 || /\s/.test(json.code)) {
				return '';
			}

			return json.code;
		} catch (e) {
			console.error('验证码解析失败: ', e);
			return '';
		}
	},

	shouldExtractCode(aiCode, aiCodeFilterStr, email) {
		if (aiCode !== settingConst.aiCode.OPEN) {
			return false;
		}

		const filterList = aiCodeFilterStr ? aiCodeFilterStr.split(',').map(item => item.trim().toLowerCase()).filter(Boolean) : [];

		if (filterList.length === 0) {
			return true;
		}

		const fromEmail = (email.from?.address || '').trim().toLowerCase();
		const fromDomain = emailUtils.getDomain(fromEmail).toLowerCase();

		return filterList.some(item => item === fromEmail || item === fromDomain);
	}
};

export default aiService;
