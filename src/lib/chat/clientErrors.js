export function formatChatHttpError(status, serverMessage = '') {
  const detail = String(serverMessage || '').trim();

  if (status === 405) {
    return 'Metode tidak diizinkan. / Method not allowed.';
  }

  if (status === 413) {
    return detail
      ? `${detail} / Payload too large.`
      : 'Lampiran terlalu besar untuk dikirim. Kompres gambar atau kirim file lebih kecil. / Attachment payload too large.';
  }

  if (status === 400) {
    return detail
      ? `${detail} / Invalid request.`
      : 'Permintaan tidak valid. / Invalid request.';
  }

  if (status === 401 || status === 403) {
    return detail
      ? `${detail} / API authentication failed.`
      : 'Autentikasi API gagal. / API authentication failed.';
  }

  if (status === 429) {
    return detail
      ? `${detail} / Too many requests.`
      : 'Terlalu banyak permintaan. Coba lagi sebentar. / Too many requests. Try again shortly.';
  }

  if (status === 502 || status === 503 || status === 504) {
    return detail
      ? `${detail} (${status}) / Server unavailable (${status}).`
      : `Server sibuk (${status}). Coba lagi. / Server unavailable (${status}).`;
  }

  if (status >= 500) {
    return detail
      ? `${detail} (${status}) / Server error (${status}).`
      : `Kesalahan server (${status}). / Server error (${status}).`;
  }

  if (status >= 400) {
    return detail
      ? `${detail} (${status}) / Request failed (${status}).`
      : `Permintaan gagal (${status}). / Request failed (${status}).`;
  }

  return detail || 'Permintaan gagal. / Request failed.';
}

export function formatChatNetworkError(error) {
  if (error?.name === 'AbortError') {
    return 'Waktu habis. Coba lagi. / Request timed out.';
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'Tidak ada koneksi internet. / No internet connection.';
  }

  return 'Tidak bisa terhubung ke server chat. Periksa koneksi Anda. / Could not reach the chat server. Check your connection.';
}

export function formatChatStreamDisconnectError() {
  return 'Koneksi putus saat streaming. Balasan mungkin tidak lengkap. / Connection dropped while streaming. The reply may be incomplete.';
}

export async function readChatHttpErrorMessage(response) {
  if (!response) return '';

  try {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return String(data?.error || data?.message || '').trim();
    }

    const text = (await response.text()).trim();
    if (!text) return '';

    try {
      const data = JSON.parse(text);
      return String(data?.error || data?.message || text).trim();
    } catch {
      return text.slice(0, 240);
    }
  } catch {
    return '';
  }
}
