import changelogRaw from "../../CHANGELOG.md?raw";

export type ChangelogSection = {
  title: string;
  items: string[];
};

export type ChangelogEntry = {
  version: string;
  date: string;
  sections: ChangelogSection[];
};

const VERSION_HEADING = /^##\s+\[([^\]]+)\]\s*(?:-\s*(\d{4}-\d{2}-\d{2}))?\s*$/;
const SECTION_HEADING = /^###\s+(.+?)\s*$/;
const LIST_ITEM = /^\s*[-*]\s+(.+?)\s*$/;

function compareSemverDesc(a: string, b: string): number {
  const parse = (v: string) =>
    v
      .split(".")
      .map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10))
      .map((n) => (Number.isFinite(n) ? n : 0));
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return db - da;
  }
  return 0;
}

export function parseChangelog(raw: string): ChangelogEntry[] {
  const lines = raw.split(/\r?\n/);
  const result: ChangelogEntry[] = [];

  let current: ChangelogEntry | null = null;
  let currentSection: ChangelogSection | null = null;

  for (const line of lines) {
    const versionMatch = line.match(VERSION_HEADING);
    if (versionMatch) {
      const [, version, date] = versionMatch;
      if (!date) {
        // Skip entries without a date (e.g. an "Unreleased" placeholder).
        current = null;
        currentSection = null;
        continue;
      }
      current = { version, date, sections: [] };
      currentSection = null;
      result.push(current);
      continue;
    }

    if (!current) continue;

    const sectionMatch = line.match(SECTION_HEADING);
    if (sectionMatch) {
      currentSection = { title: sectionMatch[1], items: [] };
      current.sections.push(currentSection);
      continue;
    }

    const itemMatch = line.match(LIST_ITEM);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1]);
    }
  }

  return result
    .filter((entry) => entry.sections.some((s) => s.items.length > 0))
    .sort((a, b) => compareSemverDesc(a.version, b.version));
}

export const entries: ChangelogEntry[] = parseChangelog(changelogRaw);

export const latestVersion: string = entries[0]?.version ?? "0.0.0";
