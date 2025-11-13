const API_BASE_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || 'http://localhost:3000/api';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const TOKEN_EXPIRY_KEY = 'access_token_expires_at';

interface RequestConfig {
  requiresAuth?: boolean;
  retry?: boolean;
}

interface RefreshResponse {
  success: boolean;
  data?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
  error?: string;
}

class ApiClient {
  private refreshingPromise: Promise<void> | null = null;

  get baseUrl(): string {
    return API_BASE_URL;
  }

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem('auth.accessToken');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem('auth.refreshToken');
  }

  getTokenExpiry(): number | null {
    const raw = localStorage.getItem(TOKEN_EXPIRY_KEY) || localStorage.getItem('auth.expiresAt');
    return raw ? Number(raw) : null;
  }

  setAuthTokens(accessToken: string, refreshToken: string, expiresAt: number): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiresAt));
    // Remove deprecated keys
    localStorage.removeItem('auth.accessToken');
    localStorage.removeItem('auth.refreshToken');
    localStorage.removeItem('auth.expiresAt');
  }

  clearAuthTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
    // Clean up deprecated keys for backward compatibility with older builds
    localStorage.removeItem('auth.accessToken');
    localStorage.removeItem('auth.refreshToken');
    localStorage.removeItem('auth.expiresAt');
  }

  /**
   * Generic API request wrapper with automatic token injection and refresh
   */
  async request<T>(endpoint: string, options: RequestInit = {}, config: RequestConfig = {}): Promise<T> {
    const { requiresAuth = true, retry = true } = config;
    const headers = new Headers(options.headers as HeadersInit | undefined);

    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    if (requiresAuth) {
      const accessToken = this.getAccessToken();
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
      });
    } catch (error) {
      // Handle network errors (server not running, CORS, etc.)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          `Unable to connect to backend server at ${url}. Please ensure the backend is running on port ${this.baseUrl.includes('3001') ? '3001' : '3000'}.`
        );
      }
      throw error;
    }

    if (response.status === 401 && requiresAuth && retry) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        return this.request<T>(endpoint, options, { requiresAuth, retry: false });
      }
      throw this.buildError(response, 'Session expired. Please sign in again.');
    }

    if (!response.ok) {
      throw await this.buildError(response);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    return {} as T;
  }

  private async tryRefreshToken(): Promise<boolean> {
    if (!this.getRefreshToken()) {
      return false;
    }

    if (this.refreshingPromise) {
      try {
        await this.refreshingPromise;
        return true;
      } catch {
        return false;
      }
    }

    this.refreshingPromise = this.refreshTokens();

    try {
      await this.refreshingPromise;
      return true;
    } catch {
      return false;
    } finally {
      this.refreshingPromise = null;
    }
  }

  private async refreshTokens(): Promise<void> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearAuthTokens();
      throw new Error('Missing refresh token');
    }

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      this.clearAuthTokens();
      throw new Error('Failed to refresh session');
    }

    const data = (await response.json()) as RefreshResponse;
    if (!data.success || !data.data) {
      this.clearAuthTokens();
      throw new Error(data.error || 'Failed to refresh session');
    }

    this.setAuthTokens(data.data.access_token, data.data.refresh_token, data.data.expires_at);
  }

  private async buildError(response: Response, fallbackMessage?: string): Promise<Error> {
    let message = fallbackMessage || `Request failed with status ${response.status}`;

    try {
      const data = await response.json();
      if (typeof data === 'object' && data) {
        message = data.error || data.message || message;
      }
    } catch {
      // ignore parse errors
    }

    return new Error(message);
  }
}

export const apiClient = new ApiClient();


