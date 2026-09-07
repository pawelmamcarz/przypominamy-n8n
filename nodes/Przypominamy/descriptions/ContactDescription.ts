import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string[]) => ({ show: { resource: ['contact'], operation } });

export const contactOperations: INodeProperties[] = [
	{
		displayName: 'Operacja',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['contact'] } },
		options: [
			{ name: 'Dodaj lub zaktualizuj', value: 'upsert', action: 'Dodaj lub zaktualizuj kontakt', description: 'POST /v1/contacts (upsert po numerze)' },
			{ name: 'Lista', value: 'list', action: 'Lista kontaktów', description: 'GET /v1/contacts' },
			{ name: 'Usuń', value: 'delete', action: 'Usuń kontakt', description: 'DELETE /v1/contacts/{id}' },
		],
		default: 'upsert',
	},
];

export const contactFields: INodeProperties[] = [
	// ── upsert ───────────────────────────────────────────────────────────
	{
		displayName: 'Numer (msisdn)',
		name: 'msisdn',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+48600100200',
		displayOptions: show(['upsert']),
		description: 'Numer telefonu; istniejący kontakt z tym numerem zostanie zaktualizowany',
	},
	{
		displayName: 'Pola kontaktu',
		name: 'contactFields',
		type: 'collection',
		placeholder: 'Dodaj pole',
		default: {},
		displayOptions: show(['upsert']),
		options: [
			{ displayName: 'Imię', name: 'firstName', type: 'string', default: '' },
			{ displayName: 'Nazwisko', name: 'lastName', type: 'string', default: '' },
			{ displayName: 'E-mail', name: 'email', type: 'string', default: '', placeholder: 'name@email.com' },
			{
				displayName: 'Pola własne (fields)',
				name: 'fields',
				type: 'json',
				default: '{}',
				placeholder: '{ "gabinet": "3", "lekarz": "dr Nowak" }',
				description: 'Obiekt JSON, do 20 pól; klucze [a-zA-Z_][a-zA-Z0-9_]. Dostępne w treści jako {{klucz}}.',
			},
			{
				displayName: 'Grupy',
				name: 'groups',
				type: 'string',
				default: '',
				placeholder: 'VIP, Pacjenci 2026',
				description: 'Nazwy lub ID grup po przecinku. Zastępuje dotychczasowe przypisania; nieznana nazwa tworzy grupę.',
			},
		],
	},

	// ── list ─────────────────────────────────────────────────────────────
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: show(['list']),
		description: 'Max number of results to return',
	},
	{
		displayName: 'Filtry',
		name: 'filters',
		type: 'collection',
		placeholder: 'Dodaj filtr',
		default: {},
		displayOptions: show(['list']),
		options: [
			{
				displayName: 'Szukaj (q)',
				name: 'q',
				type: 'string',
				default: '',
				description: 'Szuka w numerze, imieniu, nazwisku i e-mailu',
			},
			{
				displayName: 'ID grupy',
				name: 'groupId',
				type: 'string',
				default: '',
				placeholder: 'gr_…',
			},
			{
				displayName: 'Kursor',
				name: 'cursor',
				type: 'string',
				default: '',
				description: 'Wartość next_cursor z poprzedniej strony',
			},
		],
	},

	// ── delete ───────────────────────────────────────────────────────────
	{
		displayName: 'ID kontaktu',
		name: 'contactId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'ct_…',
		displayOptions: show(['delete']),
	},
];
