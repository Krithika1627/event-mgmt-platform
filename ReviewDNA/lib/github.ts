import { Octokit } from '@octokit/rest';

import type { FileDiff, ReviewIssue, ReviewSummary } from './types';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

interface ParsedDiffFile extends FileDiff {
  commentableLines: Set<number>;
}

function normalizeDiffPath(path: string): string {
  return path.replace(/^a\//, '').replace(/^b\//, '');
}

function parseHunkHeader(header: string): { oldLine: number; newLine: number } | null {
  const match = header.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
  if (!match) {
    return null;
  }

  const newLine = Number.parseInt(match[1], 10);
  const oldMatch = header.match(/^@@ -(\d+)(?:,\d+)? \+/);
  const oldLine = oldMatch ? Number.parseInt(oldMatch[1], 10) : 0;

  return { oldLine, newLine };
}

function parseRawDiff(rawDiff: string): ParsedDiffFile[] {
  const lines = rawDiff.split('\n');
  const files: ParsedDiffFile[] = [];
  let currentFile: ParsedDiffFile | null = null;
  let currentPatch: string[] = [];
  let currentLineState: { oldLine: number; newLine: number } | null = null;
  let isBinaryFile = false;
  let hasHunk = false;

  const flushCurrentFile = (): void => {
    if (!currentFile) {
      return;
    }

    currentFile.patch = currentPatch.join('\n');

    if (!isBinaryFile && hasHunk && currentFile.patch.trim().length > 0) {
      files.push(currentFile);
    }

    currentFile = null;
    currentPatch = [];
    currentLineState = null;
    isBinaryFile = false;
    hasHunk = false;
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      flushCurrentFile();
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (!match) {
        continue;
      }

      currentFile = {
        filename: normalizeDiffPath(match[2]),
        patch: '',
        additions: 0,
        deletions: 0,
        commentableLines: new Set<number>()
      };
      currentPatch = [line];
      continue;
    }

    if (!currentFile) {
      continue;
    }

    currentPatch.push(line);

    if (line.startsWith('Binary files ')) {
      isBinaryFile = true;
      continue;
    }

    if (line.startsWith('@@ ')) {
      const hunkState = parseHunkHeader(line);
      if (!hunkState) {
        continue;
      }

      currentLineState = hunkState;
      hasHunk = true;
      continue;
    }

    if (!currentLineState) {
      continue;
    }

    if (line.startsWith('+++') || line.startsWith('---')) {
      continue;
    }

    if (line.startsWith('+')) {
      currentFile.additions += 1;
      currentFile.commentableLines.add(currentLineState.newLine);
      currentLineState.newLine += 1;
      continue;
    }

    if (line.startsWith('-')) {
      currentFile.deletions += 1;
      currentLineState.oldLine += 1;
      continue;
    }

    currentFile.commentableLines.add(currentLineState.newLine);
    currentLineState.oldLine += 1;
    currentLineState.newLine += 1;
  }

  flushCurrentFile();
  return files;
}

function buildCommentableLineMap(files: Array<{ filename: string; patch?: string | null }>): Map<string, Set<number>> {
  const lineMap = new Map<string, Set<number>>();

  for (const file of files) {
    if (!file.patch) {
      continue;
    }

    const commentableLines = new Set<number>();
    const patchLines = file.patch.split('\n');
    let currentLineState: { oldLine: number; newLine: number } | null = null;

    for (const line of patchLines) {
      if (line.startsWith('@@ ')) {
        const hunkState = parseHunkHeader(line);
        if (!hunkState) {
          continue;
        }

        currentLineState = hunkState;
        continue;
      }

      if (!currentLineState) {
        continue;
      }

      if (line.startsWith('+++') || line.startsWith('---')) {
        continue;
      }

      if (line.startsWith('-')) {
        currentLineState.oldLine += 1;
        continue;
      }

      if (line.startsWith('\\')) {
        continue;
      }

      commentableLines.add(currentLineState.newLine);
      currentLineState.newLine += 1;
      currentLineState.oldLine += 1;
    }

    lineMap.set(file.filename, commentableLines);
  }

  return lineMap;
}

function formatSeverityEmoji(severity: ReviewIssue['severity']): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'info':
    default:
      return '🔵';
  }
}

function buildIssueComment(issue: ReviewIssue): string {
  const emoji = formatSeverityEmoji(issue.severity);
  return `${emoji} **${issue.type.toUpperCase()}**\n\n${issue.message}\n\n**Suggestion:** ${issue.suggestion}`;
}

function createSummaryTable(summary: ReviewSummary): string {
  return [
    '| Severity | Count |',
    '| --- | ---: |',
    `| Critical | ${summary.critical} |`,
    `| Warning | ${summary.warning} |`,
    `| Info | ${summary.info} |`
  ].join('\n');
}

function createEmptySummary(): ReviewSummary {
  return {
    critical: 0,
    warning: 0,
    info: 0,
    overall: 'No reviewable changes were found in the pull request.'
  };
}

export async function getPRDiff(owner: string, repo: string, pullNumber: number): Promise<FileDiff[]> {
  const response = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: {
      format: 'diff'
    }
  });

  const rawDiff = typeof response.data === 'string' ? response.data : String(response.data);
  return parseRawDiff(rawDiff).map(({ commentableLines: _commentableLines, ...file }) => file);
}

export async function postReviewComments(
  owner: string,
  repo: string,
  pullNumber: number,
  commitSha: string,
  issues: ReviewIssue[]
): Promise<void> {
  if (issues.length === 0) {
    return;
  }

  const files = await octokit.paginate(octokit.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100
  });

  const commentableLineMap = buildCommentableLineMap(files);
  const comments = issues
    .filter((issue) => commentableLineMap.get(issue.file)?.has(issue.line) ?? false)
    .map((issue) => ({
      path: issue.file,
      line: issue.line,
      body: buildIssueComment(issue)
    }));

  if (comments.length === 0) {
    return;
  }

  await octokit.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    commit_id: commitSha,
    event: 'COMMENT',
    comments
  });
}

export async function postSummaryComment(owner: string, repo: string, pullNumber: number, summary: ReviewSummary): Promise<void> {
  const body = [
    '## ReviewDNA Summary',
    '',
    createSummaryTable(summary),
    '',
    summary.overall
  ].join('\n');

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body
  });
}

export function createEmptyReviewSummary(): ReviewSummary {
  return createEmptySummary();
}
