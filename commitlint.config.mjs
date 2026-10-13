/**
 * Formato de commit: <tipo>(<scope>): <descripción en minúscula, imperativo>
 *
 *   feat(HU-01): registrar orden con sus ítems
 *   fix(HU-08): impedir marcar corte dos veces
 *   chore: configurar prettier y husky
 *
 * Tipos: feat, fix, docs, style, refactor, test, chore, ci, build, perf, revert.
 * En feat y fix el scope es obligatorio y es el HU (HU-XX). Varios: (HU-10,HU-11).
 */
const HU_SCOPE = /^HU-\d{2}(,HU-\d{2})*$/;

const config = {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: {
        "hu-scope-required": ({ type, scope }) => {
          if (type !== "feat" && type !== "fix") return [true];
          return [
            HU_SCOPE.test(scope ?? ""),
            "feat y fix llevan el HU como scope: feat(HU-01): descripción",
          ];
        },
      },
    },
  ],
  rules: {
    "hu-scope-required": [2, "always"],
    // El scope HU-XX va en mayúscula; config-conventional exigiría minúscula.
    "scope-case": [0],
    "header-max-length": [2, "always", 100],
  },
};

export default config;
