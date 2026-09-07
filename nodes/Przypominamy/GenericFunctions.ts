import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

const CREDENTIAL = 'przypominamyApi';

interface ApiErrorBody {
	error?: { code?: string; message?: string; param?: string };
	request_id?: string;
}

/**
 * Wywołanie REST API przypominamy.com z uwierzytelnieniem z danych dostępowych.
 * Błędy API (JSON `{ error: { code, message, param } }`) zamieniamy na NodeApiError
 * z czytelnym komunikatem, kodem HTTP i nazwą pola.
 */
export async function przypominamyRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body?: IDataObject,
	qs?: IDataObject,
	itemIndex = 0,
	extraHeaders?: Record<string, string>,
): Promise<IDataObject> {
	const credentials = await this.getCredentials(CREDENTIAL, itemIndex);
	const baseUrl = String(credentials.baseUrl || 'https://api.przypominamy.com').replace(/\/+$/, '');

	const options: IHttpRequestOptions = {
		method,
		url: `${baseUrl}${endpoint}`,
		headers: { Accept: 'application/json', 'User-Agent': 'n8n-nodes-przypominamy/1.0.0', ...(extraHeaders ?? {}) },
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (body && Object.keys(body).length > 0) options.body = body;
	if (qs && Object.keys(qs).length > 0) options.qs = cleanQuery(qs);

	const response = (await this.helpers.httpRequestWithAuthentication.call(this, CREDENTIAL, options)) as {
		statusCode: number;
		body: unknown;
		headers: Record<string, string>;
	};

	const status = response.statusCode;
	let payload = response.body;
	if (typeof payload === 'string') {
		try {
			payload = JSON.parse(payload);
		} catch {
			/* zostaw jako tekst */
		}
	}

	if (status >= 200 && status < 300) {
		return (payload ?? {}) as IDataObject;
	}

	const err = (payload ?? {}) as ApiErrorBody;
	const code = err.error?.code ?? `http_${status}`;
	const message = err.error?.message ?? (typeof payload === 'string' && payload ? payload : `Błąd HTTP ${status}`);
	const param = err.error?.param;
	const requestId = err.request_id ?? response.headers?.['x-request-id'];

	const descriptionParts: string[] = [`Kod: ${code}`];
	if (param) descriptionParts.push(`pole: ${param}`);
	if (requestId) descriptionParts.push(`request_id: ${requestId}`);
	if (status === 429 && response.headers?.['retry-after']) {
		descriptionParts.push(`spróbuj ponownie za ${response.headers['retry-after']} s`);
	}

	throw new NodeApiError(this.getNode(), { error: err.error, request_id: requestId } as JsonObject, {
		message: param ? `${message} (pole "${param}")` : message,
		description: descriptionParts.join(', '),
		httpCode: String(status),
		itemIndex,
	});
}

/** Usuwa puste wartości z query string, żeby nie wysyłać `?status=` itp. */
function cleanQuery(qs: IDataObject): IDataObject {
	const out: IDataObject = {};
	for (const [k, v] of Object.entries(qs)) {
		if (v === undefined || v === null || v === '') continue;
		out[k] = v;
	}
	return out;
}

/** Rozbija pole "to" na numer, listę numerów po przecinku / nowej linii albo `group:Nazwa`. */
export function parseRecipients(raw: unknown): string | string[] {
	if (Array.isArray(raw)) {
		return raw.map((r) => String(r).trim()).filter(Boolean);
	}
	const parts = String(raw ?? '')
		.split(/[,;\n]/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (parts.length === 1) return parts[0] as string;
	return parts;
}

/** Lista numerów z pola tekstowego (przecinki, średniki, nowe linie) albo tablicy. */
export function parseMsisdnList(raw: unknown): string[] {
	const r = parseRecipients(raw);
	return Array.isArray(r) ? r : r ? [r] : [];
}

/** Parsuje pole JSON (obiekt) — przyjmuje string albo już sparsowany obiekt. */
export function parseJsonObject(
	this: IExecuteFunctions,
	raw: unknown,
	fieldLabel: string,
	itemIndex: number,
): IDataObject | undefined {
	if (raw === undefined || raw === null || raw === '') return undefined;
	let value = raw;
	if (typeof raw === 'string') {
		try {
			value = JSON.parse(raw);
		} catch {
			throw new NodeOperationError(this.getNode(), `Pole "${fieldLabel}" musi zawierać poprawny JSON`, {
				itemIndex,
			});
		}
	}
	if (typeof value !== 'object' || Array.isArray(value)) {
		throw new NodeOperationError(this.getNode(), `Pole "${fieldLabel}" musi być obiektem JSON ({ "klucz": "wartość" })`, {
			itemIndex,
		});
	}
	return value as IDataObject;
}

/** Data z pola n8n (ISO / DateTime) → ISO 8601, puste → undefined. */
export function toIso(raw: unknown): string | undefined {
	if (raw === undefined || raw === null || raw === '') return undefined;
	const d = raw instanceof Date ? raw : new Date(String(raw));
	if (Number.isNaN(d.getTime())) return String(raw);
	return d.toISOString();
}
