import {
  ERROR_MESSAGE_ID,
  NoDotImportRule,
} from "../../src/rules/no-dot-import";
import { createRuleTester } from "../helpers/rule-tester";

createRuleTester().run("no-dot-import", NoDotImportRule, {
  valid: [
    'import * as foo from "./index";',
    'import * as foo from "./some-file";',
    'import * as foo from "react";',
    'import * as foo from "@ahlec/lib";',
  ],
  invalid: [
    {
      code: 'import * as foo from ".";',
      errors: [{ messageId: ERROR_MESSAGE_ID }],
    },
    {
      code: 'import ".";',
      errors: [{ messageId: ERROR_MESSAGE_ID }],
    },
  ],
});