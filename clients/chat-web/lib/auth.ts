export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('chat_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: any) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('chat_user', JSON.stringify(user));
}

export function clearAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('chat_user');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}
