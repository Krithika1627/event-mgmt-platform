import { NextResponse } from 'next/server';

import { verifyWebhookSignature } from '@/lib/verify';
import { runReviewPipeline } from '@/lib/review';

export const runtime = 'nodejs';

interface GitHubWebhookPayload {
  action?: string;
  repository?: {
    name?: string;
    owner?: {
      login?: string;
    };
  };
  pull_request?: {
    number?: number;
    head?: {
      sha?: string;
    };
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256') ?? '';
    const event = request.headers.get('x-github-event') ?? '';
    const secret = process.env.GITHUB_WEBHOOK_SECRET ?? '';

    if (!verifyWebhookSignature(secret, rawBody, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    if (event !== 'pull_request') {
      return NextResponse.json({ reviewed: false }, { status: 200 });
    }

    const payload = JSON.parse(rawBody) as GitHubWebhookPayload;
    if (payload.action !== 'opened' && payload.action !== 'synchronize') {
      return NextResponse.json({ reviewed: false }, { status: 200 });
    }

    const owner = payload.repository?.owner?.login;
    const repo = payload.repository?.name;
    const pullNumber = payload.pull_request?.number;
    const commitSha = payload.pull_request?.head?.sha;

    if (!owner || !repo || !pullNumber || !commitSha) {
      return NextResponse.json({ reviewed: false, error: 'Missing pull request context' }, { status: 200 });
    }

    const result = await runReviewPipeline({ owner, repo, pullNumber, commitSha });

    return NextResponse.json({ reviewed: true, issuesFound: result.issues.length }, { status: 200 });
  } catch (error) {
    console.error('Webhook review failed:', error);
    return NextResponse.json({ reviewed: false, error: 'Internal error while processing webhook' }, { status: 200 });
  }
}
