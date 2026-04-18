# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Progress Intelligence dashboard (Lakshatrack)

The unified **Progress Intelligence** UI lives in `src/pages/ProgressUnified.tsx` (routes `/progress` and `/progress-dashboard`). It uses a 12-column responsive grid, scoped design tokens (`src/progress-system/dashboard/progressDashboardTokens.css`), and modular pieces under `src/progress-system/dashboard/`.

**Run the app**

```bash
cd frontend
npm install
npm run dev
```

Open the progress dashboard from the app navigation (authenticated routes).

**Contribution heatmap — API shape**

The UI consumes `ContributionData` from the existing progress API (`src/progress-system/types/index.ts`). Each day includes a discrete intensity `level` (0–4) for coloring:

```json
{
  "year": 2026,
  "totalContributions": 420,
  "currentStreak": 12,
  "longestStreak": 30,
  "contributions": [
    { "date": "2026-01-15", "count": 3, "level": 2 },
    { "date": "2026-01-16", "count": 0, "level": 0 }
  ]
}
```

For documentation or mocks, you can think of each point as `{ "date": "<ISO date>", "value": <number> }` where **`value` maps to `count`** in the real API; **`level`** is derived for the five-step palette.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
