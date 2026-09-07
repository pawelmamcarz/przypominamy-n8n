import type { INodeProperties } from 'n8n-workflow';

const show = (operation: string[]) => ({ show: { resource: ['account'], operation } });

export const accountOperations: INodeProperties[] = [
	{
		displayName: 'Operacja',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['account'] } },
		options: [
			{ name: 'Pobierz konto', value: 'get', action: 'Pobierz konto', description: 'GET /v1/account — saldo, cennik, tryb, nadpis' },
			{ name: 'Nadpisy', value: 'senders', action: 'Lista nadpisów', description: 'GET /v1/senders — aktywne nazwy nadawcy' },
			{ name: 'Raport', value: 'report', action: 'Raport wysyłek', description: 'GET /v1/reports — dzień/miesiąc × typ × status' },
			{ name: 'Sprawdź numer (HLR)', value: 'lookup', action: 'Sprawdź numer HLR', description: 'GET /v1/numbers/{msisdn}/lookup — czy numer jest aktywny w sieci (płatne)' },
		],
		default: 'get',
	},
];

export const accountFields: INodeProperties[] = [
	{
		displayName: 'Od (from)',
		name: 'from',
		type: 'dateTime',
		default: '',
		displayOptions: show(['report']),
		description: 'Początek zakresu; puste = 30 dni przed końcem zakresu',
	},
	{
		displayName: 'Do (to)',
		name: 'to',
		type: 'dateTime',
		default: '',
		displayOptions: show(['report']),
		description: 'Koniec zakresu; puste = teraz. Maksymalny zakres 366 dni.',
	},
	{
		displayName: 'Grupowanie',
		name: 'group',
		type: 'options',
		options: [
			{ name: 'Dzień', value: 'day' },
			{ name: 'Miesiąc', value: 'month' },
		],
		default: 'day',
		displayOptions: show(['report']),
	},
	{
		displayName: 'Numer (msisdn)',
		name: 'msisdn',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+48600100200',
		displayOptions: show(['lookup']),
		description: 'Sprawdzenie pobiera opłatę z salda (price_per_hlr_grosze); wynik dla tego samego numeru jest pamiętany 24 h',
	},
];
