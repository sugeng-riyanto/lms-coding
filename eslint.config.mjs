import flatConfig from "eslint-config-next/core-web-vitals";

const config = [
  ...flatConfig,
  {
    ignores: ["node_modules/**", ".next/**", "playwright-report/**", "test-results/**"],
  },
];

export default config;
