import { describe, expect, it } from 'vitest';

import {
  formatChatHttpError,
  formatChatNetworkError,
  formatChatStreamDisconnectError,
  formatPayloadTooLargeError,
  readChatHttpErrorMessage,
} from '@src/lib/chat/clientErrors';

describe('formatChatHttpError', () => {
  it('maps common HTTP statuses to bilingual messages', () => {
    expect(formatChatHttpError(405)).toContain('Method not allowed');
    expect(formatChatHttpError(413)).toContain('Request payload too large');
    expect(formatChatHttpError(429)).toContain('Too many requests');
    expect(formatChatHttpError(503)).toContain('503');
  });

  it('maps FUNCTION_PAYLOAD_TOO_LARGE copy to payload errors', () => {
    expect(formatChatHttpError(502, 'FUNCTION_PAYLOAD_TOO_LARGE sin1::abc / Payload too large.')).toContain(
      'Request payload too large',
    );
    expect(formatPayloadTooLargeError()).toContain('Request payload too large');
  });

  it('includes server messages when provided', () => {
    expect(formatChatHttpError(400, 'messages must be a non-empty array')).toContain('messages must be a non-empty array');
    expect(formatChatHttpError(502, 'Bad gateway')).toContain('Bad gateway');
  });
});

describe('formatChatNetworkError', () => {
  it('maps abort errors to timeout copy', () => {
    expect(formatChatNetworkError({ name: 'AbortError' })).toContain('timed out');
  });
});

describe('formatChatStreamDisconnectError', () => {
  it('mentions streaming disconnect', () => {
    expect(formatChatStreamDisconnectError()).toContain('streaming');
  });
});

describe('readChatHttpErrorMessage', () => {
  it('reads JSON error payloads', async () => {
    const response = {
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({ error: 'messages must be a non-empty array' }),
    };

    await expect(readChatHttpErrorMessage(response)).resolves.toBe('messages must be a non-empty array');
  });
});
