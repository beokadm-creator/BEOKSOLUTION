# ⚠️ VERSION CONTROL PROTECTION ACTIVE ⚠️

**This repository has rollback prevention enabled.**

## Current Production Version
- **v1.0.0** (see `.DEPLOYED_VERSION` file)
- **Baseline Tag**: `v1.0.0` (commit `35aaeed`)
- **Release Notes**: [`RELEASE_NOTES_v1.0.0.md`](./RELEASE_NOTES_v1.0.0.md)

## Critical Rules (ENFORCED)

### ✅ Required for ALL Changes
- Create feature branch: `git checkout -b feature/description`
- Run tests: `npm test` (167 tests must pass)
- Fix linting: `npm run lint` (0 errors, 0 warnings)
- Create Pull Request on GitHub
- Wait for CI/CD to pass (ESLint + TypeScript + Tests + Build)
- Get review approval

### ❌ PROHIBITED
- Direct commits to `main` branch (GitHub will block)
- Skipping tests (pre-commit hooks will block)
- Rolling back to previous versions (tag protection)
- Force pushing to `main` (branch protection)

## Mandatory Reading
**Before making ANY changes**, read:
1. [`MANDATORY_WORKFLOW.md`](./MANDATORY_WORKFLOW.md) - Step-by-step workflow
2. [`VERSION_CONTROL_POLICY.md`](./VERSION_CONTROL_POLICY.md) - Version control rules
3. [`BRANCH_PROTECTION_SETUP.md`](./BRANCH_PROTECTION_SETUP.md) - GitHub setup guide

## Multi-Layer Protection
1. **Pre-commit hooks** (local): ESLint + Tests
2. **GitHub Branch Protection** (server): PR required, CI/CD validation
3. **Git Tag v1.0.0** (anchor): Immutable production baseline

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

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
