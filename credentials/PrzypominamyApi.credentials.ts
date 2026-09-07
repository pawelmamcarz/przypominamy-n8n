import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PrzypominamyApi implements ICredentialType {
	name = 'przypominamyApi';

	displayName = 'Przypominamy.com API';

	documentationUrl = 'https://przypominamy.com/integracje/n8n';

	icon = { light: 'file:../nodes/Przypominamy/przypominamy.svg', dark: 'file:../nodes/Przypominamy/przypominamy.svg' } as const;

	properties: INodeProperties[] = [
		{
			displayName: 'Klucz API',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'pk_live_…',
			description:
				'Klucz API z panelu app.przypominamy.com → Klucze API. Klucz pk_test_… działa tylko na zweryfikowane numery.',
		},
		{
			displayName: 'Sekret Webhooka',
			name: 'webhookSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			placeholder: 'whsec_…',
			description:
				'Opcjonalnie. Sekret z panelu (Webhook) używany przez węzeł Przypominamy Trigger do weryfikacji podpisu X-Przypominamy-Signature.',
		},
		{
			displayName: 'Adres API',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.przypominamy.com',
			description: 'Zostaw domyślny, chyba że korzystasz z własnej instancji bramki',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/v1/account',
			method: 'GET',
		},
	};
}
