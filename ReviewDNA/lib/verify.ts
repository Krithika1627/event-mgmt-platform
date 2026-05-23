import crypto from 'node:crypto';

export function verifyWebhookSignature(secret: string, payload: string, signature: string): boolean {
  if (!secret || !payload || !signature) {
    return false;
  }

  const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;

  const expectedBuffer = Buffer.from(expectedSignature);
  const receivedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
