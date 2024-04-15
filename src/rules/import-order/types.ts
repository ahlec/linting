import type * as ESTree from "estree";

export type SpecialPattern = "{node}" | "{unmatched}";

interface SettingAdvancedStringImportPattern {
  pattern: string;

  /**
   * How the {@see pattern} field should be interpretted:
   * - "raw-string": The pattern is a raw string and string equality should
   *                 be used for matching
   * - "regex": The pattern is a regular expression
   * - "glob": The pattern is a glob pattern and should be used with
   *           micromatch
   *
   * @default "glob"
   */
  type?: "raw-string" | "regex" | "glob";

  /**
   * If @true, the pattern will match imports regardless of their casing
   * (eg, a pattern of "*.png" will match "image.png" and "image.PNG").
   * If @false, the pattern will only match with exact casing.
   *
   * @default true
   */
  caseInsensitive?: boolean;
}

export type SettingImportPattern = string | SettingAdvancedStringImportPattern;

/**
 * An element of the order definition array can either be a single pattern
 * or an array of patterns, all of which can be intermingled.
 */
export type SettingImportOrderEntry =
  | SettingImportPattern
  | readonly SettingImportPattern[];

export interface ImportOrderRuleSettings {
  debug?: boolean;
  order: readonly SettingImportOrderEntry[];
}

interface OrderEntryImport {
  isUnmatchedEntry: boolean;
  match: (importSource: string) => ImportSourceMatch | null;
}

export interface ImportSourceMatch {
  pattern: string;
}

export type OrderEntry = OrderEntryImport;

export type EntryMatch =
  | {
      index: number;
      wasUnmatched: false;
      matchedPattern: string;
    }
  | {
      index: number;
      wasUnmatched: true;
    };

export interface ModuleRecord {
  orderEntry: EntryMatch | null;
  originalImportIndex: number;
  node: ESTree.Node;
  source: string;
}

export interface AssignedImportOrderGroup {
  definition: OrderEntry;
  startIndex: number;
}
