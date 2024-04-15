import type { AST, Rule } from "eslint";
import type * as ESTree from "estree";
import type {
  EntryMatch,
  ImportOrderRuleSettings,
  ModuleRecord,
} from "./types";

const DEBUG_COMMENT_PREFIX = "[@ahlec/import-order::DEBUG] ";

type GetDebugModuleFixerFn = (record: ModuleRecord) => Rule.ReportFixer | null;

function isDebugComment(str: string): boolean {
  return str.startsWith(DEBUG_COMMENT_PREFIX);
}

function getDebugCommentRangesInReverseOrder(
  node: ESTree.Node,
): readonly AST.Range[] {
  if (!node.trailingComments?.length) {
    return [];
  }

  const ranges: AST.Range[] = [];
  for (const comment of node.trailingComments) {
    console.log("alec!!!!", comment.value);
    if (isDebugComment(comment.value)) {
      if (!comment.range) {
        throw new Error("Comment without range?");
      }

      ranges.push(comment.range);
    }
  }

  return ranges.sort((a, b) => b[0] - a[0]);
}

function removeDebugCommentsModuleFixer(
  record: ModuleRecord,
): Rule.ReportFixer | null {
  const toRemove = getDebugCommentRangesInReverseOrder(record.node);
  if (!toRemove.length) {
    return null;
  }

  return (fixer) => toRemove.map((range) => fixer.removeRange(range));
}

function getDebugComment(match: EntryMatch | null): string {
  if (!match) {
    return "DOES NOT MATCH ANY PATTERN";
  }

  if (match.wasUnmatched) {
    return `DOES NOT MATCH ANY PATTERN; Grouped together with '{unmatched}' [${match.index}]`;
  }

  return `MATCHED '${match.matchedPattern}' [${match.index}]`;
}

function appendDebugCommentsModuleFixer(
  record: ModuleRecord,
): Rule.ReportFixer | null {
  const expectedComment = `${DEBUG_COMMENT_PREFIX}${getDebugComment(
    record.orderEntry,
  )}`;

  // If we already have the debug comment and it doesn't need updating,
  // no changes
  if (
    record.node.trailingComments?.length &&
    record.node.trailingComments?.every(
      (comment) =>
        !isDebugComment(comment.value) || comment.value === expectedComment,
    )
  ) {
    return null;
  }

  // Update the debug comment
  return function* (fixer) {
    // Remove any existing debug comments, if there are any
    const toRemove = getDebugCommentRangesInReverseOrder(record.node);
    for (const range of toRemove) {
      yield fixer.removeRange(range);
    }

    // Append the new debug comment
    yield fixer.insertTextAfter(record.node, `// ${expectedComment}`);
  };
}

interface ParseDebugResult {
  getDebugModuleFixer: GetDebugModuleFixerFn;
}

export function parseDebug(options: ImportOrderRuleSettings): ParseDebugResult {
  const debug = options.debug === true;
  return {
    getDebugModuleFixer: debug
      ? appendDebugCommentsModuleFixer
      : removeDebugCommentsModuleFixer,
  };
}
