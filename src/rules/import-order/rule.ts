import type { JSONSchema4 } from "json-schema";
import type { Rule } from "eslint";
import makeModuleListener from "../../utils/makeModuleListener";
import { parseDebug } from "./options-debug";
import { parseOrder } from "./options-order";
import type {
  EntryMatch,
  ImportOrderRuleSettings,
  ModuleRecord,
} from "./types";
import { assignImportGroups } from "./determine-groups";

/**
 * UGH
 *
 * It's a graph problem, sort of like djikstra's algo.
 *
 * You have your starting array. You then have your ending array.
 * You want to figure out the smallest number of changes to get from start to
 * end.
 */

const SettingImportPatternJsonSchema: JSONSchema4 = {
  anyOf: [
    { type: "string" },
    {
      type: "object",
      properties: {
        pattern: { type: "string" },
        caseInsensitive: { type: "boolean" },
        type: { enum: ["raw-string", "regex", "glob"] },
      },
      required: ["pattern"],
    },
  ],
};

// If no entry matches, then this import isn't covered and we should look to
// the settings to know what to do
// TODO:
//     - Implement option: "report node as error if not defined"
//     - Implement special order rule for "[others]" and move any unmatched in here
//          Use case: ["[node]", "[others]", "*.css"] or something
//     - Implement option/shortcut for a trailing "*" pattern at end of options (shortcut)

export const ImportOrderRule: Rule.RuleModule = {
  create: (context): Rule.RuleListener => {
    const options: ImportOrderRuleSettings | undefined = context.options[0];
    if (!options) {
      throw new Error("Options for this rule must be specified");
    }

    const { entries, unmatchedIndex } = parseOrder(options);
    const { getDebugModuleFixer } = parseDebug(options);

    const records: ModuleRecord[] = [];
    const fallbackMatch: EntryMatch | null =
      typeof unmatchedIndex === "number"
        ? {
            index: unmatchedIndex,
            wasUnmatched: true,
          }
        : null;

    return {
      ...makeModuleListener(({ node, source }): void => {
        const orderEntry = entries.reduce<EntryMatch | null>(
          (existing, entry, index): EntryMatch | null => {
            // We only ever match the first entry we find in the order
            // If we have an entry, then we don't match anything after it
            if (existing) {
              return existing;
            }

            const match = entry.match(source);
            if (match) {
              return {
                index,
                wasUnmatched: false,
                matchedPattern: match.pattern,
              };
            }

            return null;
          },
          null,
        );

        records.push({
          orderEntry: orderEntry ?? fallbackMatch,
          originalImportIndex: records.length,
          node,
          source,
        });
      }),
      "Program:exit": (): void => {
        const assignedGroups = assignImportGroups(entries, records);
        console.log("assigned:", assignedGroups);

        // Find the order the imports SHOULD be in
        // const canonicalOrder = [...records].sort((a, b): number => {
        //   if (!a.orderEntry || !b.orderEntry) {
        //     throw new Error("TODO: ???");
        //   }

        //   // Group imports of the same level together
        //   if (a.orderEntry.index !== b.orderEntry.index) {
        //     return b.orderEntry.index - a.orderEntry.index;
        //   }

        //   // Alphabetize imports within the same level
        //   return a.source.localeCompare(b.source);
        // });

        // We want to diff the GROUPS first, then individual entries
        //  1. unsorted original order -> entry groups
        //  2. find the largest set of consecutive incremental runs in these entry groups
        //        eg, original is like [1, 2, 2, 1, 4, 4, 4, 5, 5, 5, 3]
        //            so we'd identify that the longest consecutive incremental runs
        //            are [1, 2, 2] and [4, 4, 4, 5, 5, 5]
        //  3. from the consecutive incremental runs, attempt to apply all of the entry
        //     groups
        //        eg, above, we'd say the group starts would be
        //            group 1 = index 0
        //            group 2 = index 1
        //            group 3 = index 3 (or 4)
        //            group 4 = index 4
        //            group 5 = index 7
        //  4. THEN, we can identify all of the imports that are in the wrong section
        //  5. *FINALLY*, any import that IS in the right section should be alphabetized
        //     to determine if it's in the right spot inside

        // TEMP: Mark any import that isn't in the correct place with an error
        // canonicalOrder.forEach((record, index): void => {
        //   const debugFixer = getDebugModuleFixer(record);

        //   if (record.originalImportIndex === index) {
        //     if (debugFixer) {
        //       context.report({
        //         node: record.node,
        //         message: "[DEBUG (no error)] Modifying debug information",
        //         fix: debugFixer,
        //       });
        //     }

        //     return;
        //   }

        //   context.report({
        //     node: record.node,
        //     message: `Import '${record.source}' is in incorrect place`,
        //     fix: debugFixer, // TODO
        //   });
        // });
      },
    };
  },
  meta: {
    fixable: "code",
    schema: [
      {
        type: "object",
        properties: {
          order: {
            type: "array",
            items: {
              anyOf: [
                SettingImportPatternJsonSchema,
                { type: "array", items: SettingImportPatternJsonSchema },
              ],
            },
          },
        },
        required: ["order"],
      },
    ],
  },
};

/**
 * Orig : [1, 1, 5, 2, 6, 3, 3]
 *         a  b  c  d  e  f  g
 * Canon: [1, 1, 2, 3, 3, 5, 6]
 *
 *     orig     canon    dist
 * a     0       0        0
 * b     1       1        0
 * c     2       5        3
 * d     3       2        -1
 * e     4       6        2
 * f     5       3        -2
 * g     6       4        -2
 *
 * [a, b, c, d, e, f, g]
 * [a, b, d, e, f, g, c] move c to end (3)
 * [a, c, d, f, g, c, e] move e to end (2)
 * [a, b, d, f, g, c, e]
 *
 * ====================
 *
 * Orig:  [4, 3, 2, 1]
 *         a  b  c  d
 * Canon: [1, 2, 3, 4]
 *
 *     orig  canon  dist
 * a      0      3     3
 * b      1      2     1
 * c      2      1    -1
 * d      3      0    -3
 *
 *
 * [a, b, c, d]
 * [b, c, d, a] move a to end
 * [d, b, c, a] move d to start
 *
 */

// Oh wait is this just a sorting problem?
