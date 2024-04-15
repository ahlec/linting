import { ImportOrderRule } from "../../src/rules/import-order/rule";
import type { ImportOrderRuleSettings } from "../../src/rules/import-order/types";
import { createRuleTester } from "../helpers/rule-tester";

function code(...lines: readonly string[]): string {
  return lines.join("\n");
}

createRuleTester().run("import-order", ImportOrderRule, {
  valid: [],
  invalid: [
    {
      code: code(
        "import React from \"react\"; // [@ahlec/import-order::DEBUG] MATCHED '@ahlec/**/*' [2]",
        'import ReactDOM from "react-dom";',
        'import styles from "./styles.scss";',
        'import { FOO } from "@ahlec/constants";',
        'import MyComponent from "@ahlec/components/MyComponent";',
        'import fs from "fs";',
        'import LocalComponent from "./LocalComponent";',
      ),
      name: "Invalid Test Case #1",
      options: [
        {
          debug: true,
          order: [
            "{node}",
            ["react", "react-*"],
            "@ahlec/**/*",
            "{unmatched}",
            "*.scss",
          ],
        } satisfies ImportOrderRuleSettings,
      ],
      errors: [{ message: "something wrong!" }],
    },
  ],
});
