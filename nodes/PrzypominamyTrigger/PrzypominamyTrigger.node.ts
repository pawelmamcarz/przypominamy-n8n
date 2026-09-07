import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

const MAX_AGE_SECONDS = 300;


export class PrzypominamyTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Przypominamy.com Trigger',
		name: 'przypominamyTrigger',
		icon: 'file:przypominamy.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{ $parameter["events"].join(", ") }}',
		description:
			'Uruchamia workflow, gdy przypominamy.com wyśle webhook: status doręczenia SMS, odpowiedź odbiorcy albo kliknięcie w link',
		defaults: { name: 'Przypominamy.com Trigger' },
		inputs: [],
		outputs: [NodeConnectionType.Main],
		credentials: [{ name: 'przypominamyApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'przypominamy',
			},
		],
		properties: [
			{
				displayName:
					'Skopiuj adres Production URL z góry tego węzła i wklej go w panelu <a href="https://app.przypominamy.com/webhook" target="_blank">app.przypominamy.com/webhook</a>. Wyświetlony tam sekret (whsec_…) wpisz w danych dostępowych jako Sekret Webhooka — węzeł odrzuci wywołania bez poprawnego podpisu.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Zdarzenia',
				name: 'events',
				type: 'multiOptions',
				required: true,
				options: [
					{ name: 'Wysłana (message.sent)', value: 'message.sent', description: 'Dostawca przyjął wiadomość do doręczenia' },
					{ name: 'Doręczona (message.delivered)', value: 'message.delivered' },
					{ name: 'Niedoręczona (message.undelivered)', value: 'message.undelivered' },
					{ name: 'Błąd (message.failed)', value: 'message.failed' },
					{ name: 'Wygasła (message.expired)', value: 'message.expired' },
					{ name: 'Odpowiedź odbiorcy (message.received)', value: 'message.received', description: 'SMS przychodzący (2-way); data.inbound + data.opt_out' },
					{ name: 'Kliknięcie w link (link.clicked)', value: 'link.clicked', description: 'Pierwsze kliknięcie w śledzony link {{link:…}}' },
				],
				default: ['message.delivered', 'message.undelivered', 'message.failed', 'message.expired'],
				description: 'Które zdarzenia mają uruchamiać workflow. Pozostałe są potwierdzane (200), ale ignorowane.',
			},
			{
				displayName: 'Opcje',
				name: 'options',
				type: 'collection',
				placeholder: 'Dodaj opcję',
				default: {},
				options: [
					{
						displayName: 'Weryfikuj podpis',
						name: 'verifySignature',
						type: 'boolean',
						default: true,
						description:
							'Sprawdza nagłówek X-Przypominamy-Signature (HMAC-SHA256 z sekretem webhooka, okno 5 minut). Wyłącz tylko do testów.',
					},
					{
						displayName: 'Tylko dane zdarzenia',
						name: 'dataOnly',
						type: 'boolean',
						default: false,
						description: 'Emituje samą treść data (np. rekord wiadomości) zamiast całej koperty { id, type, created_at, data }.',
					},
				],
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const res = this.getResponseObject();
		const headers = this.getHeaderData() as Record<string, string | undefined>;
		const events = this.getNodeParameter('events', []) as string[];
		const options = this.getNodeParameter('options', {}) as { verifySignature?: boolean; dataOnly?: boolean };
		const verify = options.verifySignature !== false;

		const rawBody = getRawBody(req);

		if (verify) {
			const credentials = await this.getCredentials('przypominamyApi');
			const secret = String(credentials.webhookSecret ?? '').trim();
			if (!secret) {
				res.status(500).json({
					error: 'Brak sekretu webhooka. Wpisz whsec_… z panelu (Webhook) w danych dostępowych Przypominamy.com API albo wyłącz weryfikację podpisu w opcjach węzła.',
				});
				return { noWebhookResponse: true };
			}
			const check = verifySignature(headers['x-przypominamy-signature'], rawBody, secret);
			if (!check.ok) {
				res.status(401).json({ error: check.reason });
				return { noWebhookResponse: true };
			}
		}

		let payload: IDataObject;
		try {
			payload = (typeof req.body === 'object' && req.body !== null ? req.body : JSON.parse(rawBody)) as IDataObject;
		} catch {
			res.status(400).json({ error: 'Nieprawidłowy JSON' });
			return { noWebhookResponse: true };
		}

		const type = String(payload.type ?? headers['x-przypominamy-event'] ?? '');
		if (events.length > 0 && !events.includes(type)) {
			// Potwierdzamy odbiór, żeby bramka nie ponawiała, ale nie uruchamiamy workflow.
			res.status(200).json({ ok: true, ignored: type });
			return { noWebhookResponse: true };
		}

		const out = options.dataOnly ? ((payload.data as IDataObject) ?? {}) : payload;
		const meta: IDataObject = {};
		if (headers['x-przypominamy-delivery']) meta.delivery_id = headers['x-przypominamy-delivery'];

		return {
			workflowData: [this.helpers.returnJsonArray(options.dataOnly ? { ...out, event: type, ...meta } : { ...out, ...meta })],
		};
	}
}

function getRawBody(req: { rawBody?: Buffer | string; body?: unknown }): string {
	if (req.rawBody !== undefined && req.rawBody !== null) {
		return Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : String(req.rawBody);
	}
	// n8n zawsze przekazuje rawBody dla webhooków; poniżej tylko awaryjnie (JSON bez spacji jak w bramce).
	if (typeof req.body === 'string') return req.body;
	return JSON.stringify(req.body ?? '');
}

export function verifySignature(
	header: string | undefined,
	rawBody: string,
	secret: string,
	nowSeconds = Math.floor(Date.now() / 1000),
): { ok: true } | { ok: false; reason: string } {
	if (!header) return { ok: false, reason: 'Brak nagłówka X-Przypominamy-Signature' };

	let t: number | undefined;
	const sigs: string[] = [];
	for (const part of header.split(',')) {
		const [k, v] = part.trim().split('=', 2);
		if (k === 't' && v) t = Number(v);
		if (k === 'v1' && v) sigs.push(v.toLowerCase());
	}
	if (!t || !Number.isFinite(t) || sigs.length === 0) {
		return { ok: false, reason: 'Nieprawidłowy format podpisu (oczekiwano t=<unix>,v1=<hex>)' };
	}
	if (Math.abs(nowSeconds - t) > MAX_AGE_SECONDS) {
		return { ok: false, reason: `Podpis starszy niż ${MAX_AGE_SECONDS} s — odrzucono (ochrona przed powtórką)` };
	}

	const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
	const expectedBuf = Buffer.from(expected, 'hex');
	for (const s of sigs) {
		if (!/^[0-9a-f]+$/.test(s)) continue;
		const got = Buffer.from(s, 'hex');
		if (got.length === expectedBuf.length && timingSafeEqual(got, expectedBuf)) return { ok: true };
	}
	return { ok: false, reason: 'Nieprawidłowy podpis webhooka' };
}
