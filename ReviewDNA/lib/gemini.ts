import { GoogleGenerativeAI } from '@google/generative-ai';

import type { FileDiff, ReviewResult } from './types';

const REVIEW_PROMPT = `You are a senior software engineer performing a code review. Analyze the
following pull request diff and identify issues. Focus on:
1. Bugs and logical errors (severity: critical)
2. Security vulnerabilities — SQL injection, XSS, hardcoded secrets,
   missing auth checks (severity: critical)
3. Performance problems — N+1 queries, missing indexes, memory leaks (severity: warning)
4. Code quality — missing error handling, poor naming, code smells (severity: warning)
5. Style and best practices — readability, maintainability (severity: info)

Return ONLY a valid JSON object with this exact structure, no markdown:
{
  "issues": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "warning" | "info",
      "type": "bug" | "security" | "performance" | "quality" | "style",
      "message": "Clear explanation of the issue",
      "suggestion": "Concrete fix or improvement"
    }
  ],
  "summary": {
    "critical": 0,
    "warning": 0,
    "info": 0,
    "overall": "Brief 1-2 sentence assessment of the PR"
  }
}

If a line number cannot be determined, use 1. Only report genuine issues —
do not invent problems. If the code looks good, return an empty issues array.`;

function stripCodeFences(responseText: string): string {
  const trimmed = responseText.trim();
  if (!trimmed.startsWith('```')) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractJsonObject(responseText: string): string {
  const strippedText = stripCodeFences(responseText);
  const startIndex = strippedText.indexOf('{');
  const endIndex = strippedText.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('Gemini response did not contain valid JSON.');
  }

  return strippedText.slice(startIndex, endIndex + 1);
}

function normalizeReviewResult(parsed: Partial<ReviewResult>): ReviewResult {
  const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
  const summary = parsed.summary ?? {
    critical: 0,
    warning: 0,
    info: 0,
    overall: 'No summary was returned by the model.'
  };

  return {
    issues,
    summary: {
      critical: Number(summary.critical ?? 0),
      warning: Number(summary.warning ?? 0),
      info: Number(summary.info ?? 0),
      overall: String(summary.overall ?? 'No summary was returned by the model.')
    }
  };
}

export function buildReviewPrompt(files: FileDiff[]): string {
  const fileSections = files
    .map(
      (file) => `File: ${file.filename}\nAdditions: ${file.additions}\nDeletions: ${file.deletions}\nPatch:\n${file.patch}`
    )
    .join('\n\n---\n\n');

  return `${REVIEW_PROMPT}\n\nPull request diff:\n\n${fileSections}`;
}

export async function reviewCode(files: FileDiff[]): Promise<ReviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: 'gemini-2.5-flash'
  });

  const response = await model.generateContent(buildReviewPrompt(files));
  const responseText = response.response.text();
  const parsed = JSON.parse(extractJsonObject(responseText)) as Partial<ReviewResult>;

  return normalizeReviewResult(parsed);
}
