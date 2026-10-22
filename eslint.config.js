import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";
export default tseslint.config(...tseslint.configs.recommended, {
  files: ["**/*.{ts,tsx}"],
  languageOptions: { globals: { ...globals.browser, ...globals.node } },
  plugins: { "react-hooks": hooks },
  rules: { ...hooks.configs.recommended.rules },
});
