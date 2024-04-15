import isCore from "is-core-module";
import { maxBy } from "lodash";
import micromatch from "micromatch";
import type {
  ImportOrderRuleSettings,
  OrderEntry,
  SettingImportPattern,
  SpecialPattern,
} from "./types";

function isImportEntryArray(
  o: SettingImportPattern | readonly SettingImportPattern[],
): o is readonly SettingImportPattern[] {
  return Array.isArray(o);
}

function makeStandardImportMatcher(
  pattern: string,
  isMatch: (importSource: string) => boolean,
): OrderEntry {
  return {
    isUnmatchedEntry: false,
    match: (importSource) => {
      if (isMatch(importSource)) {
        return { pattern };
      }

      return null;
    },
  };
}

const SPECIAL_PATTERN_ENTRIES: Record<SpecialPattern, OrderEntry> = {
  "{node}": makeStandardImportMatcher("{node}", isCore),
  "{unmatched}": {
    match: () => null,
    isUnmatchedEntry: true,
  },
};

function isSpecialPattern(str: string): str is SpecialPattern {
  return Boolean(SPECIAL_PATTERN_ENTRIES[str]);
}

function parsePattern(raw: SettingImportPattern): OrderEntry {
  const {
    pattern,
    type = "glob",
    caseInsensitive = true,
  } = typeof raw === "string" ? { pattern: raw } : raw;

  if (/^\{(.*)\}$/.test(pattern)) {
    if (!isSpecialPattern(pattern)) {
      throw new Error(`Unrecognized special pattern: '${pattern}'`);
    }

    return SPECIAL_PATTERN_ENTRIES[pattern];
  }

  switch (type) {
    case "raw-string": {
      const lowerCasePattern = pattern.toLowerCase();
      return makeStandardImportMatcher(
        pattern,
        caseInsensitive
          ? (str) => str.toLowerCase() === lowerCasePattern
          : (str) => str === pattern,
      );
    }
    case "glob": {
      return makeStandardImportMatcher(pattern, (str) =>
        micromatch.isMatch(str, pattern, {
          // dot: true,
          nocase: caseInsensitive,
        }),
      );
    }
    case "regex": {
      const regex = new RegExp(pattern, caseInsensitive ? "i" : undefined);
      return makeStandardImportMatcher(pattern, (str) => regex.test(str));
    }
  }
}

interface ParseOrderResult {
  entries: readonly OrderEntry[];
  unmatchedIndex: number | null;
}

export function parseOrder(
  settings: ImportOrderRuleSettings,
): ParseOrderResult {
  if (!settings.order.length) {
    // TODO: Return this from function, report error w/ settings
    throw new Error("Order must be specified");
  }

  const entries = settings.order.map((definition, index): OrderEntry => {
    const entries: OrderEntry[] = isImportEntryArray(definition)
      ? definition.map((pattern) => parsePattern(pattern))
      : [parsePattern(definition)];

    if (!entries.length) {
      // TODO: Return this and report error w/ settings
      throw new Error(`Index ${index} was an empty array`);
    }

    if (entries.length === 1) {
      return entries[0];
    }

    return {
      match: (str) => {
        const matches = entries.map((entry) => entry.match(str));
        // TODO: Improve/define what "best" means? Is what's here actually "best"
        // or is "best" the most specific (eg, shortest?)
        return (
          maxBy(matches, (match) => (match ? match.pattern.length : -1)) ?? null
        );
      },
      isUnmatchedEntry: entries.some((entry) => entry.isUnmatchedEntry),
    };
  });

  if (entries.filter((entry) => entry.isUnmatchedEntry).length > 1) {
    // TODO: Return this from function, report error
    throw new Error("Multiple unmatched entries");
  }

  const unmatchedIndex = entries.findIndex((entry) => entry.isUnmatchedEntry);
  return {
    entries,
    unmatchedIndex: unmatchedIndex >= 0 ? unmatchedIndex : null,
  };
}
