// Auto-detect backend URL based on current origin, with fallback to env variable or localhost
const getApiBaseUrl = (): string => {
  // If explicitly set in env, use that
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL.replace(/\/$/, '');
  }
  
  // Auto-detect based on current origin
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    
    // If accessing via domain, use domain API
    if (origin.includes('evidentlyaeo.com')) {
      return `${origin}/api`;
    }
    
    // If accessing via IP, use IP API
    if (origin.includes('85.239.244.166')) {
      return `${origin}/api`;
    }
  }
  
  // Default fallback to localhost for development
  return 'http://localhost:3000/api';
};

const API_BASE_URL = getApiBaseUrl();

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

  private isAbortError(error: unknown): boolean {
    // In browsers, aborts can surface as DOMException (not always instanceof Error)
    // or as an Error-like object with name/message.
    if (!error || (typeof error !== 'object' && typeof error !== 'function')) return false;
    const anyErr = error as any;
    const name = typeof anyErr.name === 'string' ? anyErr.name : '';
    const message = typeof anyErr.message === 'string' ? anyErr.message : '';
    return name === 'AbortError' || message.toLowerCase().includes('aborted');
  }

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
    const requestStart = performance.now();
    const { requiresAuth = true, retry = true } = config;
    const headers = new Headers(options.headers as HeadersInit | undefined);
    const method = (options.method || 'GET').toUpperCase();
    const hasPayload = options.body !== undefined && options.body !== null;
    const slowApiLogEnabled =
      typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_LOG_SLOW_API === 'true';

    if (!headers.has('Content-Type') && method !== 'GET' && hasPayload) {
      headers.set('Content-Type', 'application/json');
    }

    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    if (requiresAuth) {
      const accessToken = this.getAccessToken();
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
    }
    
    // Log slow requests (>5 seconds) for debugging
    const logSlowRequest = (duration: number, status?: number) => {
      // Avoid noisy warnings by default; enable explicitly via VITE_LOG_SLOW_API=true
      if (slowApiLogEnabled && duration > 5000) {
        console.warn(`⚠️ Slow API request: ${endpoint} took ${duration.toFixed(2)}ms${status ? ` (status: ${status})` : ''}`);
      }
    };

    // Add timeout to prevent hanging requests (30 seconds default)
    const timeoutMs = 30000; // 30 seconds
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, timeoutMs);
    
    // Merge abort signals if provided
    let finalSignal: AbortSignal;
    if (options.signal) {
      // If caller provided a signal, create a merged controller
      const mergedController = new AbortController();
      const abort = () => mergedController.abort();
      // If already aborted, preserve semantics: fetch should abort immediately
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        throw new DOMException('The operation was aborted.', 'AbortError');
      }
      options.signal.addEventListener('abort', abort, { once: true });
      timeoutController.signal.addEventListener('abort', abort, { once: true });
      finalSignal = mergedController.signal;
    } else {
      finalSignal = timeoutController.signal;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        signal: finalSignal,
      });
      clearTimeout(timeoutId);
      const fetchDuration = performance.now() - requestStart;
      logSlowRequest(fetchDuration, response.status);
    } catch (error) {
      clearTimeout(timeoutId);
      const errorDuration = performance.now() - requestStart;
      
      // Handle timeout/abort errors
      if (this.isAbortError(error)) {
        // Check if timeout occurred (timeoutController aborted but caller signal didn't)
        if (timeoutController.signal.aborted && !options.signal?.aborted) {
          // Timeout occurred
          console.error(`❌ Request timeout: ${endpoint} timed out after ${timeoutMs}ms (actual: ${errorDuration.toFixed(2)}ms)`);
          throw new Error(`Request to ${endpoint} timed out after ${timeoutMs}ms. The server may be slow or unresponsive.`);
        }
        // Otherwise it was a user-initiated abort, rethrow as-is
        throw error;
      }
      
      // Handle network errors (server not running, CORS, etc.)
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const port = this.baseUrl.includes('3001') ? '3001' : '3000';
        const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
        console.error(`❌ Network error: ${endpoint} failed after ${errorDuration.toFixed(2)}ms`);
        throw new Error(
          `Unable to connect to backend server at ${url}. ` +
          `Please ensure: 1) Backend is running on port ${port}, ` +
          `2) CORS is configured to allow requests from ${currentOrigin}, ` +
          `3) No firewall or network issues are blocking the connection.`
        );
      }
      console.error(`❌ Request error: ${endpoint} failed after ${errorDuration.toFixed(2)}ms:`, error);
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
      const errorDuration = performance.now() - requestStart;
      logSlowRequest(errorDuration, response.status);
      throw await this.buildError(response);
    }

    const contentType = response.headers.get('content-type');
    let result: T;
    if (contentType && contentType.includes('application/json')) {
      result = await response.json() as T;
    } else {
      result = {} as T;
    }
    const totalDuration = performance.now() - requestStart;
    logSlowRequest(totalDuration, response.status);
    
    return result;
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

  // Convenience methods
  async get<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, config);
  }

  async post<T>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    );
  }

  async put<T>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PUT',
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    );
  }

  async delete<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' }, config);
  }

  async patch<T>(endpoint: string, data?: any, config: RequestConfig = {}): Promise<T> {
    return this.request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: data ? JSON.stringify(data) : undefined,
      },
      config
    );
  }
}

export const apiClient = new ApiClient();


