import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// Next.js 16 removed the `next lint` command; linting now runs through the
// ESLint CLI with flat config. This keeps the same rule set `next lint` applied.
const eslintConfig = [
  { ignores: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'] },
  ...nextCoreWebVitals,
];

export default eslintConfig;