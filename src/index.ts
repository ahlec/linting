import type { ESLint } from "eslint";
import { ImportOrderRule } from "./rules/import-order/rule";
import { NoDotImportRule } from "./rules/no-dot-import";
import { NoExtraneousIndexRule } from "./rules/no-extraneous-index";
import { PreferAliasForParentImportRule } from "./rules/prefer-alias-for-parent-import";
import { PreferRelativeForNestedImport } from "./rules/prefer-relative-for-nested-import";

const plugin: ESLint.Plugin = {
  rules: {
    "import-order": ImportOrderRule,
    "no-dot-import": NoDotImportRule,
    "no-extraneous-index": NoExtraneousIndexRule,
    "prefer-alias-for-parent-import": PreferAliasForParentImportRule,
    "prefer-relative-for-nested-import": PreferRelativeForNestedImport,
  },
};

export = plugin;
