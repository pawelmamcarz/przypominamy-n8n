import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string[]) => ({ show: { resource: ['group'], operation } });

export const groupOperations: INodeProperties[] = [
	{
		displayName: 'Operacja',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['group'] } },
		options: [
			{ name: 'Lista', value: 'list', action: 'Lista grup', description: 'GET /v1/groups' },
			{ name: 'Utwórz', value: 'create', action: 'Utwórz grupę', description: 'POST /v1/groups' },
			{ name: 'Dodaj kontakty', value: 'addContacts', action: 'Dodaj kontakty do grupy', description: 'POST /v1/groups/{id}/contacts' },
		],
		default: 'list',
	},
];

export const groupFields: INodeProperties[] = [
	{
		displayName: 'Nazwa',
		name: 'name',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'VIP',
		displayOptions: show(['create']),
		description: 'Do 80 znaków, unikalna (bez rozróżniania wielkości liter)',
	},
	{
		displayName: 'ID grupy',
		name: 'groupId',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'gr_…',
		displayOptions: show(['addContacts']),
	},
	{
		displayName: 'Numery (msisdns)',
		name: 'msisdns',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+48600100200, +48600100201',
		displayOptions: show(['addContacts']),
		description: 'Numery po przecinku (do 500). Numery bez kontaktu zostaną dodane do książki.',
	},
];
