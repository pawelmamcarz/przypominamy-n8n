import type { INodeProperties } from 'n8n-workflow';

export const templateOperations: INodeProperties[] = [
	{
		displayName: 'Operacja',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['template'] } },
		options: [
			{ name: 'Lista', value: 'list', action: 'Lista szablonów', description: 'GET /v1/templates' },
		],
		default: 'list',
	},
];

export const templateFields: INodeProperties[] = [];
