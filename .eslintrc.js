/** Konfiguracja z oficjalnego n8n-nodes-starter: reguły społeczności n8n dla węzłów i danych dostępowych. */
module.exports = {
	root: true,
	env: { browser: true, es6: true, node: true },
	parser: '@typescript-eslint/parser',
	parserOptions: { project: ['./tsconfig.json'], sourceType: 'module', extraFileExtensions: ['.json'] },
	ignorePatterns: ['.eslintrc.js', '**/*.js', '**/node_modules/**', '**/dist/**'],
	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
			rules: { 'n8n-nodes-base/community-package-json-name-still-default': 'off' },
		},
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				'n8n-nodes-base/cred-class-field-documentation-url-missing': 'off',
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
			},
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
			rules: {
				'n8n-nodes-base/node-execute-block-missing-continue-on-fail': 'off',
				'n8n-nodes-base/node-resource-description-filename-against-convention': 'off',
				// Interfejs węzła jest po polsku — reguły o angielskiej wielkości liter i alfabetycznej kolejności
				// (statusy są w kolejności cyklu życia, nie alfabetycznej) nie mają tu zastosowania.
				'n8n-nodes-base/node-param-display-name-miscased': 'off',
				'n8n-nodes-base/node-param-operation-option-action-miscased': 'off',
				'n8n-nodes-base/node-param-description-boolean-without-whether': 'off',
				'n8n-nodes-base/node-param-options-type-unsorted-items': 'off',
				'n8n-nodes-base/node-param-multi-options-type-unsorted-items': 'off',
				'n8n-nodes-base/node-param-collection-type-unsorted-items': 'off',
				'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',
				'n8n-nodes-base/node-param-option-name-wrong-for-upsert': 'off',
				'n8n-nodes-base/node-param-option-description-wrong-for-upsert': 'off',
				'n8n-nodes-base/node-param-description-wrong-for-upsert': 'off',
				// Opisy operacji cytują ścieżki API ({id}) — reguła zamieniałaby je na {ID}.
				'n8n-nodes-base/node-param-description-miscased-id': 'off',
				// inputs/outputs: [NodeConnectionType.Main] to aktualna konwencja n8n (enum ma wartość 'main').
				'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
				'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
			},
		},
	],
};
