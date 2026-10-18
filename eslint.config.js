import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.cloudflare/**', '**/.wrangler/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'worker/scripts/**/*.mjs'],
    languageOptions: {
      globals: Object.fromEntries(
        [
          'process',
          'console',
          'Buffer',
          'fetch',
          'URL',
          'URLSearchParams',
          'TextDecoder',
          'TextEncoder',
          'AbortSignal',
          'setTimeout',
          'clearTimeout',
          'crypto',
          'structuredClone',
        ].map((name) => [name, 'readonly']),
      ),
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  prettier,
)
