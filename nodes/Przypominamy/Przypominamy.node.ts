import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';

import {
	accountFields,
	accountOperations,
	blacklistFields,
	blacklistOperations,
	contactFields,
	contactOperations,
	groupFields,
	groupOperations,
	messageFields,
	messageOperations,
	templateFields,
	templateOperations,
} from './descriptions';
import { parseJsonObject, parseMsisdnList, parseRecipients, przypominamyRequest, toIso } from './GenericFunctions';

export class Przypominamy implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Przypominamy.com SMS',
		name: 'przypominamy',
		icon: 'file:przypominamy.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
		description: 'Wysyłka SMS i wiadomości głosowych, kontakty, grupy, czarna lista i raporty w API SMS przypominamy.com',
		defaults: { name: 'Przypominamy.com SMS' },
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		usableAsTool: true,
		credentials: [{ name: 'przypominamyApi', required: true }],
		properties: [
			{
				displayName: 'Zasób',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Wiadomość', value: 'message' },
					{ name: 'Kontakt', value: 'contact' },
					{ name: 'Grupa', value: 'group' },
					{ name: 'Czarna lista', value: 'blacklist' },
					{ name: 'Konto', value: 'account' },
					{ name: 'Szablon', value: 'template' },
				],
				default: 'message',
			},
			...messageOperations,
			...messageFields,
			...contactOperations,
			...contactFields,
			...groupOperations,
			...groupFields,
			...blacklistOperations,
			...blacklistFields,
			...accountOperations,
			...accountFields,
			...templateOperations,
			...templateFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let result: IDataObject | IDataObject[];

				if (resource === 'message') {
					result = await executeMessage.call(this, operation, i);
				} else if (resource === 'contact') {
					result = await executeContact.call(this, operation, i);
				} else if (resource === 'group') {
					result = await executeGroup.call(this, operation, i);
				} else if (resource === 'blacklist') {
					result = await executeBlacklist.call(this, operation, i);
				} else if (resource === 'account') {
					result = await executeAccount.call(this, operation, i);
				} else if (resource === 'template') {
					result = await executeTemplate.call(this, operation, i);
				} else {
					throw new NodeOperationError(this.getNode(), `Nieznany zasób "${resource}"`, { itemIndex: i });
				}

				const rows = Array.isArray(result) ? result : [result];
				for (const row of rows) {
					returnData.push({ json: row, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					const e = error as { message?: string; description?: string; httpCode?: string; context?: IDataObject };
					returnData.push({
						json: {
							error: e.message ?? String(error),
							description: e.description,
							httpCode: e.httpCode,
							...(e.context?.error ? { api_error: e.context.error } : {}),
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}

// ── Wiadomość ──────────────────────────────────────────────────────────────

async function executeMessage(this: IExecuteFunctions, operation: string, i: number): Promise<IDataObject | IDataObject[]> {
	if (operation === 'sendSms' || operation === 'sendVoice') {
		const to = parseRecipients(this.getNodeParameter('to', i));
		if (!to || (Array.isArray(to) && to.length === 0)) {
			throw new NodeOperationError(this.getNode(), 'Podaj co najmniej jednego odbiorcę w polu "Odbiorca (to)"', { itemIndex: i });
		}
		const text = (this.getNodeParameter('text', i, '') as string).trim();
		const add = this.getNodeParameter('additionalFields', i, {}) as IDataObject;

		const body: IDataObject = { to };
		if (text) body.text = text;
		if (add.templateId) {
			body.template_id = String(add.templateId);
			const params = parseJsonObject.call(this, add.params, 'Parametry szablonu (params)', i);
			if (params && Object.keys(params).length > 0) body.params = params;
		}
		if (!body.text && !body.template_id) {
			throw new NodeOperationError(this.getNode(), 'Podaj treść wiadomości albo ID szablonu', { itemIndex: i });
		}
		if (add.purpose) body.purpose = String(add.purpose).trim();
		if (add.from) body.from = String(add.from).trim();
		const sendAt = toIso(add.sendAt);
		if (sendAt) body.send_at = sendAt;
		if (add.sendWindow) body.send_window = String(add.sendWindow).trim();
		const expiresAt = toIso(add.expiresAt);
		if (expiresAt) body.expires_at = expiresAt;
		if (add.reference) body.reference = String(add.reference);

		const headers: Record<string, string> = {};
		if (add.idempotencyKey) headers['Idempotency-Key'] = String(add.idempotencyKey).slice(0, 128);

		if (operation === 'sendSms') {
			if (add.priority === true) body.priority = true;
			return przypominamyRequest.call(this, 'POST', '/v1/messages', body, undefined, i, headers);
		}

		body.lector = this.getNodeParameter('lector', i, 'ewa') as string;
		const tries = this.getNodeParameter('tries', i, 1) as number;
		if (tries && tries !== 1) body.tries = tries;
		return przypominamyRequest.call(this, 'POST', '/v1/voice', body, undefined, i, headers);
	}

	if (operation === 'get') {
		const id = encodeURIComponent((this.getNodeParameter('messageId', i) as string).trim());
		return przypominamyRequest.call(this, 'GET', `/v1/messages/${id}`, undefined, undefined, i);
	}

	if (operation === 'cancel') {
		const id = encodeURIComponent((this.getNodeParameter('messageId', i) as string).trim());
		return przypominamyRequest.call(this, 'DELETE', `/v1/messages/${id}`, undefined, undefined, i);
	}

	if (operation === 'list') {
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		const qs: IDataObject = {
			limit: this.getNodeParameter('limit', i, 50) as number,
			status: filters.status,
			type: filters.type,
			to: filters.to,
			reference: filters.reference,
			cursor: filters.cursor,
		};
		return przypominamyRequest.call(this, 'GET', '/v1/messages', undefined, qs, i);
	}

	throw new NodeOperationError(this.getNode(), `Nieznana operacja "${operation}" dla zasobu Wiadomość`, { itemIndex: i });
}

// ── Kontakt ────────────────────────────────────────────────────────────────

async function executeContact(this: IExecuteFunctions, operation: string, i: number): Promise<IDataObject> {
	if (operation === 'upsert') {
		const fields = this.getNodeParameter('contactFields', i, {}) as IDataObject;
		const body: IDataObject = { msisdn: (this.getNodeParameter('msisdn', i) as string).trim() };
		if (fields.firstName !== undefined && fields.firstName !== '') body.first_name = String(fields.firstName);
		if (fields.lastName !== undefined && fields.lastName !== '') body.last_name = String(fields.lastName);
		if (fields.email !== undefined && fields.email !== '') body.email = String(fields.email);
		const custom = parseJsonObject.call(this, fields.fields, 'Pola własne (fields)', i);
		if (custom && Object.keys(custom).length > 0) body.fields = custom;
		if (fields.groups !== undefined && String(fields.groups).trim() !== '') {
			body.groups = parseMsisdnList(fields.groups);
		}
		return przypominamyRequest.call(this, 'POST', '/v1/contacts', body, undefined, i);
	}

	if (operation === 'list') {
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		const qs: IDataObject = {
			limit: this.getNodeParameter('limit', i, 100) as number,
			q: filters.q,
			group_id: filters.groupId,
			cursor: filters.cursor,
		};
		return przypominamyRequest.call(this, 'GET', '/v1/contacts', undefined, qs, i);
	}

	if (operation === 'delete') {
		const id = encodeURIComponent((this.getNodeParameter('contactId', i) as string).trim());
		return przypominamyRequest.call(this, 'DELETE', `/v1/contacts/${id}`, undefined, undefined, i);
	}

	throw new NodeOperationError(this.getNode(), `Nieznana operacja "${operation}" dla zasobu Kontakt`, { itemIndex: i });
}

// ── Grupa ──────────────────────────────────────────────────────────────────

async function executeGroup(this: IExecuteFunctions, operation: string, i: number): Promise<IDataObject> {
	if (operation === 'list') {
		return przypominamyRequest.call(this, 'GET', '/v1/groups', undefined, undefined, i);
	}
	if (operation === 'create') {
		const name = (this.getNodeParameter('name', i) as string).trim();
		return przypominamyRequest.call(this, 'POST', '/v1/groups', { name }, undefined, i);
	}
	if (operation === 'addContacts') {
		const id = encodeURIComponent((this.getNodeParameter('groupId', i) as string).trim());
		const msisdns = parseMsisdnList(this.getNodeParameter('msisdns', i));
		if (msisdns.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Podaj co najmniej jeden numer', { itemIndex: i });
		}
		return przypominamyRequest.call(this, 'POST', `/v1/groups/${id}/contacts`, { msisdns }, undefined, i);
	}
	throw new NodeOperationError(this.getNode(), `Nieznana operacja "${operation}" dla zasobu Grupa`, { itemIndex: i });
}

// ── Czarna lista ───────────────────────────────────────────────────────────

async function executeBlacklist(this: IExecuteFunctions, operation: string, i: number): Promise<IDataObject> {
	if (operation === 'add') {
		const msisdns = parseMsisdnList(this.getNodeParameter('msisdns', i));
		if (msisdns.length === 0) {
			throw new NodeOperationError(this.getNode(), 'Podaj co najmniej jeden numer', { itemIndex: i });
		}
		const body: IDataObject = { msisdns };
		const reason = (this.getNodeParameter('reason', i, '') as string).trim();
		if (reason) body.reason = reason;
		const expiresAt = toIso(this.getNodeParameter('expiresAt', i, ''));
		if (expiresAt) body.expires_at = expiresAt;
		return przypominamyRequest.call(this, 'POST', '/v1/blacklist', body, undefined, i);
	}
	if (operation === 'remove') {
		const msisdn = encodeURIComponent((this.getNodeParameter('msisdn', i) as string).trim());
		return przypominamyRequest.call(this, 'DELETE', `/v1/blacklist/${msisdn}`, undefined, undefined, i);
	}
	if (operation === 'list') {
		const qs: IDataObject = {
			limit: this.getNodeParameter('limit', i, 100) as number,
			cursor: this.getNodeParameter('cursor', i, ''),
		};
		return przypominamyRequest.call(this, 'GET', '/v1/blacklist', undefined, qs, i);
	}
	throw new NodeOperationError(this.getNode(), `Nieznana operacja "${operation}" dla zasobu Czarna lista`, { itemIndex: i });
}

// ── Konto ──────────────────────────────────────────────────────────────────

async function executeAccount(this: IExecuteFunctions, operation: string, i: number): Promise<IDataObject> {
	if (operation === 'get') {
		return przypominamyRequest.call(this, 'GET', '/v1/account', undefined, undefined, i);
	}
	if (operation === 'senders') {
		return przypominamyRequest.call(this, 'GET', '/v1/senders', undefined, undefined, i);
	}
	if (operation === 'report') {
		const qs: IDataObject = {
			from: toIso(this.getNodeParameter('from', i, '')),
			to: toIso(this.getNodeParameter('to', i, '')),
			group: this.getNodeParameter('group', i, 'day'),
		};
		return przypominamyRequest.call(this, 'GET', '/v1/reports', undefined, qs, i);
	}
	if (operation === 'lookup') {
		const msisdn = encodeURIComponent((this.getNodeParameter('msisdn', i) as string).trim());
		return przypominamyRequest.call(this, 'GET', `/v1/numbers/${msisdn}/lookup`, undefined, undefined, i);
	}
	throw new NodeOperationError(this.getNode(), `Nieznana operacja "${operation}" dla zasobu Konto`, { itemIndex: i });
}

// ── Szablon ────────────────────────────────────────────────────────────────

async function executeTemplate(this: IExecuteFunctions, operation: string, i: number): Promise<IDataObject> {
	if (operation === 'list') {
		return przypominamyRequest.call(this, 'GET', '/v1/templates', undefined, undefined, i);
	}
	throw new NodeOperationError(this.getNode(), `Nieznana operacja "${operation}" dla zasobu Szablon`, { itemIndex: i });
}
