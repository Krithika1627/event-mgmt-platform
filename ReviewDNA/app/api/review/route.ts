import { Octokit } from '@octokit/rest';
import { NextResponse } from 'next/server';

import { runReviewPipeline } from '@/lib/review';

export const runtime = 'nodejs';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

interface ManualReviewRequest {
  owner?: string;
  repo?: string;
  pullNumber?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ManualReviewRequest;
    const owner = body.owner;
    const repo = body.repo;
    const pullNumber = body.pullNumber;

    if (!owner || !repo || !pullNumber) {
      return NextResponse.json({ error: 'owner, repo, and pullNumber are required' }, { status: 400 });
    }

    const pullRequest = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber
    });

    const commitSha = pullRequest.data.head.sha;
    const result = await runReviewPipeline({ owner, repo, pullNumber, commitSha });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Manual review failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected error while running review'
      },
      { status: 500 }
    );
  }
}
