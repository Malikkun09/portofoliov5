import { PAYLOAD_HARD_LIMIT_BYTES, estimatePayloadBytes } from '@src/lib/chat/payloadBudget';

export const PAYLOAD_TOO_LARGE_MESSAGE =
  'Permintaan terlalu besar untuk dikirim. Coba kirim gambar lebih kecil atau mulai obrolan baru. / Request payload too large. Try a smaller image or start a new chat.';

export function validateChatRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, status: 400, error: 'Invalid request body' };
  }

  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return { ok: false, status: 400, error: 'messages must be a non-empty array' };
  }

  const estimatedBytes = estimatePayloadBytes(body);

  if (estimatedBytes > PAYLOAD_HARD_LIMIT_BYTES) {
    return {
      ok: false,
      status: 413,
      error: PAYLOAD_TOO_LARGE_MESSAGE,
      code: 'PAYLOAD_TOO_LARGE',
    };
  }

  return { ok: true, estimatedBytes };
}
