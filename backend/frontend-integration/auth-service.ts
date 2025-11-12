// Frontend Authentication Service
// This file should be placed in your frontend project

const API_BASE_URL = 'http://localhost:3000/api';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  customer_id: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  provider: string;
  customer_id: string;
}

export interface AuthResponse {
  user: User;
  profile: UserProfile;
  session: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
}

export interface BrandOnboardingRequest {
  brand_name: string;
  website_url: string;
  description?: string;
  industry?: string;
  competitors?: string[];
  keywords?: string[];
  aeo_topics?: Array<{
    label: string;
    weight: number;
  }>;
}

export interface Brand {
  id: string;
  customer_id: string;
  name: string;
  website_url: string;
  description?: string;
  industry?: string;
  created_at: string;
  updated_at: string;
}

export interface BrandOnboardingResponse {
  brand: Brand;
  artifact_id: string;
  message: string;
}

class AuthService {
  private accessToken: string | null = null;

  constructor() {
    // Load token from localStorage on initialization
    this.accessToken = localStorage.getItem('access_token');
  }

  // Set access token
  setAccessToken(token: string): void {
    this.accessToken = token;
    localStorage.setItem('access_token', token);
  }

  // Get access token
  getAccessToken(): string | null {
    return this.accessToken;
  }

  // Clear tokens
  clearTokens(): void {
    this.accessToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  // Get headers with authorization
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    return headers;
  }

  // Handle API response
  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'API request failed');
    }

    return data.data;
  }

  // Google OAuth authentication
  async signInWithGoogle(code: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/google`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ code }),
    });

    const authResponse = await this.handleResponse<AuthResponse>(response);
    
    // Store tokens
    this.setAccessToken(authResponse.session.access_token);
    localStorage.setItem('refresh_token', authResponse.session.refresh_token);

    return authResponse;
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    if (!this.accessToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        this.clearTokens();
        return null;
      }

      const data = await response.json();
      return data.data.user;
    } catch (error) {
      console.error('Error getting current user:', error);
      this.clearTokens();
      return null;
    }
  }

  // Get user profile
  async getUserProfile(): Promise<UserProfile | null> {
    if (!this.accessToken) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        this.clearTokens();
        return null;
      }

      const data = await response.json();
      return data.data.profile;
    } catch (error) {
      console.error('Error getting user profile:', error);
      this.clearTokens();
      return null;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    if (this.accessToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/signout`, {
          method: 'POST',
          headers: this.getHeaders(),
        });
      } catch (error) {
        console.error('Error signing out:', error);
      }
    }

    this.clearTokens();
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  // Brand onboarding
  async createBrand(brandData: BrandOnboardingRequest): Promise<BrandOnboardingResponse> {
    const response = await fetch(`${API_BASE_URL}/brands`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(brandData),
    });

    return this.handleResponse<BrandOnboardingResponse>(response);
  }

  // Get brands
  async getBrands(): Promise<Brand[]> {
    const response = await fetch(`${API_BASE_URL}/brands`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<Brand[]>(response);
  }

  // Get brand by ID
  async getBrand(brandId: string): Promise<Brand> {
    const response = await fetch(`${API_BASE_URL}/brands/${brandId}`, {
      headers: this.getHeaders(),
    });

    return this.handleResponse<Brand>(response);
  }

  // Update brand
  async updateBrand(brandId: string, updateData: Partial<BrandOnboardingRequest>): Promise<Brand> {
    const response = await fetch(`${API_BASE_URL}/brands/${brandId}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updateData),
    });

    return this.handleResponse<Brand>(response);
  }

  // Delete brand
  async deleteBrand(brandId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/brands/${brandId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete brand');
    }
  }
}

export const authService = new AuthService();
