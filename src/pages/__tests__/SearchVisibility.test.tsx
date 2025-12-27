import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SearchVisibility } from '../SearchVisibility';
import { MemoryRouter } from 'react-router-dom';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams('?startDate=2024-01-01&endDate=2024-01-07'), vi.fn()],
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/metrics/visibility', search: '?startDate=2024-01-01&endDate=2024-01-07' }),
  };
});

vi.mock('../../store/authStore', () => ({
  useAuthStore: (selector: any) => selector({
    user: { id: 'test-user', email: 'test@example.com' },
    isLoading: false,
  }),
}));

vi.mock('../../hooks/useCachedData', () => ({
  useCachedData: vi.fn(),
}));

vi.mock('../../manual-dashboard/useManualBrandDashboard', () => ({
  useManualBrandDashboard: vi.fn(),
}));

// Mock Chart.js to avoid canvas errors
vi.mock('react-chartjs-2', () => ({
  Line: () => <div data-testid="line-chart">Line Chart</div>,
  Bar: () => <div data-testid="bar-chart">Bar Chart</div>,
}));

vi.mock('../../components/Layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

import { useCachedData } from '../../hooks/useCachedData';
import { useManualBrandDashboard } from '../../manual-dashboard/useManualBrandDashboard';

describe('SearchVisibility Component', () => {
  const mockBrands = [
    { id: 'brand-1', name: 'Brand A' },
    { id: 'brand-2', name: 'Brand B' }
  ];

  const mockResponseData = {
    success: true,
    data: {
      llmVisibility: [
        { 
          provider: 'GPT-4', 
          date: '2024-01-01', 
          mention_rate: 0.5, 
          impact_score: 80,
          visibility: 80,
          share: 50,
          totalQueries: 100,
          brandPresenceCount: 50,
          timeSeries: {
            visibility: [80, 80, 80, 80, 80, 80, 80],
            share: [50, 50, 50, 50, 50, 50, 50],
            dates: ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-06', '2024-01-07']
          }
        }
      ],
      competitorVisibility: []
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (useManualBrandDashboard as any).mockReturnValue({
      brands: mockBrands,
      selectedBrandId: 'brand-1',
      selectedBrand: mockBrands[0],
      isLoading: false,
      error: null,
      selectBrand: vi.fn(),
    });

    (useCachedData as any).mockReturnValue({
      data: mockResponseData,
      loading: false,
      error: null,
    });
  });

  it('renders loading state initially', () => {
    (useCachedData as any).mockReturnValue({
      data: null,
      loading: true,
      error: null,
    });

    render(
      <MemoryRouter>
        <SearchVisibility />
      </MemoryRouter>
    );

    // Should show loading screen (from LoadingScreen component)
    // We assume LoadingScreen renders something identifiable or we check for "Loading..." text
    // Since we didn't mock LoadingScreen, it renders its content.
    // Let's assume it has text "Loading visibility data..."
    // But in SearchVisibility it says "Loading visibility data..."
    expect(screen.getByText(/Loading visibility data/i)).toBeInTheDocument();
  });

  it('renders chart when data is loaded', async () => {
    render(
      <MemoryRouter>
        <SearchVisibility />
      </MemoryRouter>
    );

    // Should wait for loading to finish and chart to appear
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  it('shows error if brands fail to load', () => {
    (useManualBrandDashboard as any).mockReturnValue({
      brands: [],
      selectedBrandId: null,
      selectedBrand: null,
      isLoading: false,
      error: 'Failed to fetch brands',
      selectBrand: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SearchVisibility />
      </MemoryRouter>
    );

    expect(screen.getByText(/Failed to fetch brands/i)).toBeInTheDocument();
  });

  it('shows error if visibility data fails to load', () => {
    (useCachedData as any).mockReturnValue({
      data: null,
      loading: false,
      error: { message: 'API Error' },
    });

    render(
      <MemoryRouter>
        <SearchVisibility />
      </MemoryRouter>
    );

    expect(screen.getByText(/API Error/i)).toBeInTheDocument();
  });

  it('does NOT show "Select at least one LLM model" error on initial load', async () => {
    // This simulates the race condition where models are present but selection might be empty momentarily
    // Our fix ensures we show loading state instead of error
    
    // Scenario: Data loaded, but selection initialization pending (simulated by component logic)
    // Actually, in test environment, useEffects run synchronously or predictable.
    
    render(
      <MemoryRouter>
        <SearchVisibility />
      </MemoryRouter>
    );

    // We expect the chart to eventually appear
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    // And we expect the error message NOT to be there
    expect(screen.queryByText(/Select at least one LLM model to display/i)).not.toBeInTheDocument();
  });

  it('shows "No data available" when no models exist', async () => {
    (useCachedData as any).mockReturnValue({
      data: { success: true, data: { llmVisibility: [], competitorVisibility: [] } },
      loading: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <SearchVisibility />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/No data available for the selected period/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/Select at least one LLM model to display/i)).not.toBeInTheDocument();
  });
});
