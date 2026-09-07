import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string[]) => ({ show: { resource: ['blacklist'], operation } });

export const blacklistOperations: INodeProperties[] = [
	{
		displayName: 'Operacja',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['blacklist'] } },
		options: [
			{ name: 'Dodaj', value: 'add', action: 'Dodaj numery do czarnej listy', description: 'POST /v1/blacklist' },
			{ name: 'Usuń', value: 'remove', action: 'Usuń numer z czarnej listy', description: 'DELETE /v1/blacklist/{msisdn}' },
			{ name: 'Lista', value: 'list', action: 'Lista czarnej listy', description: 'GET /v1/blacklist' },
		],
		default: 'add',
	},
];

export const blacklistFields: INodeProperties[] = [
	{
		displayName: 'Numery (msisdns)',
		name: 'msisdns',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+48600100200, +48600100201',
		displayOptions: show(['add']),
		description: 'Numery po przecinku (do 1000). Odbiorcy z czarnej listy nie dostają wiadomości (status rejected, bez opłaty).',
	},
	{
		displayName: 'Powód',
		name: 'reason',
		type: 'string',
		default: '',
		placeholder: 'reklamacja',
		displayOptions: show(['add']),
		description: 'Do 120 znaków; domyślnie "manual"',
	},
	{
		displayName: 'Wygasa (expires_at)',
		name: 'expiresAt',
		type: 'dateTime',
		default: '',
		displayOptions: show(['add']),
		description: 'Opcjonalny termin, po którym wpis przestaje obowiązywać',
	},
	{
		displayName: 'Numer (msisdn)',
		name: 'msisdn',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+48600100200',
		displayOptions: show(['remove']),
	},
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
		displayName: 'Kursor',
		name: 'cursor',
		type: 'string',
		default: '',
		displayOptions: show(['list']),
		description: 'Wartość next_cursor z poprzedniej strony',
	},
];
