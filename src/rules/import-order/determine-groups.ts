import type {
  AssignedImportOrderGroup,
  ModuleRecord,
  OrderEntry,
} from "./types";

interface AscendingRun {
  // Indices are inclusive
  recordIndices: [start: number, end: number];

  // Indices are inclusive
  groupsIndexRange: [start: number, end: number];
  groupStartIndices: Record<number, number | undefined>;
}

function findAllAscendingRuns(
  records: readonly ModuleRecord[],
): readonly AscendingRun[] {
  let currentPartial: {
    startRecordIndex: number;
    startGroupIndex: number;
    currentGroupIndex: number;
    groupStartIndices: Record<number, number | undefined>;
  } | null = null;

  const runs: AscendingRun[] = [];
  for (let index = 0; index < records.length; ++index) {
    const record = records[index];
    if (!record.orderEntry) {
      throw new Error("????");
    }

    // Does this record fit into the current run
    if (
      currentPartial &&
      currentPartial.currentGroupIndex <= record.orderEntry.index
    ) {
      if (currentPartial.currentGroupIndex < record.orderEntry.index) {
        currentPartial.currentGroupIndex = record.orderEntry.index;
        currentPartial.groupStartIndices[record.orderEntry.index] = index;
      }
      continue;
    }

    // This record breaks the run
    if (currentPartial) {
      runs.push({
        recordIndices: [currentPartial.startRecordIndex, index - 1],
        groupsIndexRange: [
          currentPartial.startGroupIndex,
          currentPartial.currentGroupIndex,
        ],
        groupStartIndices: currentPartial.groupStartIndices,
      });
    }

    currentPartial = {
      startRecordIndex: index,
      startGroupIndex: record.orderEntry.index,
      currentGroupIndex: record.orderEntry.index,
      groupStartIndices: {
        [record.orderEntry.index]: index,
      },
    };
  }

  if (currentPartial && records.length > 0) {
    runs.push({
      recordIndices: [currentPartial.startRecordIndex, records.length - 1],
      groupsIndexRange: [
        currentPartial.startGroupIndex,
        currentPartial.currentGroupIndex,
      ],
      groupStartIndices: currentPartial.groupStartIndices,
    });
  }

  return runs;
}

/**
 * Given a collection of unordered runs, which might have overlaps among
 * them (eg, multiple runs in different locations might contain 3), finds
 * the best collection of runs that are in order and do not overlap.
 */
function findBestRunFit(
  allRuns: readonly AscendingRun[],
): readonly AscendingRun[] {
  return findBestRunFitRecursive(allRuns, 0, -1).runs;
}

interface FindBestRunFitRecursiveResults {
  runs: readonly AscendingRun[];
  numImportsCovered: number;
  numGroupsCovered: number;
}

function findBestRunFitRecursive(
  allRuns: readonly AscendingRun[],
  currentRunIndex: number,
  highestGroupIndex: number,
): FindBestRunFitRecursiveResults {
  // Base case: We're at the end
  if (allRuns.length <= currentRunIndex) {
    return {
      runs: [],
      numImportsCovered: 0,
      numGroupsCovered: 0,
    };
  }

  // We're CURRENTLY on the run indicated by the index
  // Is the score better if we include this run, or if we
  // skip this run?

  let resIncluded: FindBestRunFitRecursiveResults | null;
  // Could we even include this run at all?
  const run = allRuns[currentRunIndex];
  if (highestGroupIndex < run.groupsIndexRange[0]) {
    const recursed = findBestRunFitRecursive(
      allRuns,
      currentRunIndex + 1,
      run.groupsIndexRange[1],
    );
    resIncluded = {
      runs: [run, ...recursed.runs],
      numImportsCovered:
        run.recordIndices[1] -
        run.recordIndices[0] +
        1 +
        recursed.numImportsCovered,
      numGroupsCovered:
        Object.keys(run.groupStartIndices).length + recursed.numGroupsCovered,
    };
  } else {
    resIncluded = null;
  }

  const resSkipped = findBestRunFitRecursive(
    allRuns,
    currentRunIndex + 1,
    highestGroupIndex,
  );

  // Which possibility is better?
  if (!resIncluded) {
    return resSkipped;
  }

  if (resIncluded.numGroupsCovered !== resSkipped.numGroupsCovered) {
    return resIncluded.numGroupsCovered > resSkipped.numGroupsCovered
      ? resIncluded
      : resSkipped;
  }

  return resIncluded.numImportsCovered > resSkipped.numImportsCovered
    ? resIncluded
    : resSkipped;
}

export function assignImportGroups(
  entries: readonly OrderEntry[],
  records: readonly ModuleRecord[],
): readonly AssignedImportOrderGroup[] {
  const allRuns = findAllAscendingRuns(records);
  const bestRunFit = findBestRunFit(allRuns);

  let bestRunFitIndex = 0;
  return entries.map((definition, groupIndex): AssignedImportOrderGroup => {
    // Find the start index for this entry
    while (
      bestRunFitIndex < bestRunFit.length &&
      bestRunFit[bestRunFitIndex].groupsIndexRange[1] < groupIndex
    ) {
      bestRunFitIndex++;
    }

    let startIndex: number;
    if (bestRunFitIndex >= bestRunFit.length) {
      // We're past all of the groups that were defined in runs.
      // That means all the other groups come at the very end, at the final
      // possible index
      startIndex = Math.max(0, records.length - 1);
    } else if (bestRunFit[bestRunFitIndex].groupsIndexRange[0] <= groupIndex) {
      let currGroupIndex = groupIndex;
      let groupStartIndex: number | undefined;
      do {
        // A run might not be fully consecutive. As long as it's strictly
        // increasing, it doesn't need to be hole-less.
        // In the case we have a run like [1, 2, 4] we would want 3 to
        // just use the start index for 4
        groupStartIndex =
          bestRunFit[bestRunFitIndex].groupStartIndices[currGroupIndex];
        currGroupIndex++; // increment for next iteration if needed
      } while (typeof groupStartIndex !== "number");

      startIndex = groupStartIndex;
    } else {
      // This group either:
      //     a) isn't found in any of the records, or;
      //     b) the records aren't in any of the runs
      // We'll therefore assign this group to be located at the start index
      // for the next defined-and-in-place group
      startIndex = bestRunFit[bestRunFitIndex].recordIndices[0];
    }

    return {
      definition,
      startIndex,
    };
  });
}
