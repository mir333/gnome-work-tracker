const BASE = `${import.meta.env.VITE_API_URL}/api`;

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: unknown) =>
    request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: "DELETE" }),

  /** Download binary blob (for Excel export) */
  async getBlob(path: string): Promise<Blob> {
    const res = await fetch(`${BASE}${path}`, {
      credentials: "include",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.blob();
  },
};
