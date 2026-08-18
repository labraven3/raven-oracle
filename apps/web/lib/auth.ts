import { API_BASE_URL } from "./api-config";

const TOKEN_KEY = "raven_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
}

export async function logout(): Promise<void> {
  const token = getToken();
  
  // Clear token immediately (optimistic)
  clearToken();
  
  // Notify backend if we had a token
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    } catch {
      // Ignore errors - token already cleared locally
    }
  }
  
  // Redirect to home page
  if (typeof window !== "undefined") {
    window.location.href = "/";
  }
}
