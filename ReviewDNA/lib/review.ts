import { createEmptyReviewSummary, getPRDiff, postReviewComments, postSummaryComment } from './github';
import { reviewCode } from './gemini';
import type { ReviewResult } from './types';

interface ReviewPipelineOptions {
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
}

function createEmptyReviewResult(message: string): ReviewResult {
  return {
    issues: [],
    summary: {
      ...createEmptyReviewSummary(),
      overall: message
    }
  };
}

export async function runReviewPipeline({ owner, repo, pullNumber, commitSha }: ReviewPipelineOptions): Promise<ReviewResult> {
  const diffs = await getPRDiff(owner, repo, pullNumber);
  if (diffs.length === 0) {
    return createEmptyReviewResult('No reviewable diff files were found in this pull request.');
  }

  const shouldTruncate = diffs.length > 50;
  const reviewFiles = shouldTruncate ? diffs.slice(0, 20) : diffs;
  const result = await reviewCode(reviewFiles);

  if (shouldTruncate) {
    result.summary.overall = `${result.summary.overall} Note: This pull request has ${diffs.length} changed files, so only the first 20 were sent to Gemini.`;
  }

  if (result.issues.length > 0) {
    await postReviewComments(owner, repo, pullNumber, commitSha, result.issues);
  }

  await postSummaryComment(owner, repo, pullNumber, result.summary);
  return result;
}
