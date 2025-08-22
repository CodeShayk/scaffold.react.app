import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '@/components/Dashboard';
import { useAuthStore } from '@/stores/authStore';
import { container } from '@/di/container';
import { TYPES } from '@/types';

// Mock the auth store
vi.mock('@/stores/authStore');

// Mock the DI container
vi.mock('@/di/container');

describe('Dashboard', () => {
  const mockUser = {
    id: '123',
    name: 'Test User',
    email: 'test@example.com',
    avatar: 'https://github.com/images/error/octocat_happy.gif'
  };

  const mockRepositories = [
    {
      id: 1,
      name: 'test-repo',
      description: 'A test repository',
      language: 'TypeScript',
      stargazers_count: 5
    },
    {
      id: 2,
      name: 'another-repo',
      description: 'Another test repository',
      language: 'JavaScript',
      stargazers_count: 10
    }
  ];

  let mockApiClient: any;
  let mockUseAuthStore: any;

  beforeEach(() => {
    mockApiClient = {
      getRepositories: vi.fn()
    };

    mockUseAuthStore = {
      user: mockUser,
      logout: vi.fn(),
      isLoading: false
    };

    (useAuthStore as any).mockReturnValue(mockUseAuthStore);
    (container.get as any).mockReturnValue(mockApiClient);
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <Dashboard />
      </BrowserRouter>
    );
  };

  it('should render user information', async () => {
    mockApiClient.getRepositories.mockResolvedValueOnce({
      data: mockRepositories
    });

    renderDashboard();

    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    mockUseAuthStore.isLoading = true;
    
    renderDashboard();
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('should fetch and display repositories', async () => {
    mockApiClient.getRepositories.mockResolvedValueOnce({
      data: mockRepositories
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('test-repo')).toBeInTheDocument();
      expect(screen.getByText('A test repository')).toBeInTheDocument();
      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('⭐ 5')).toBeInTheDocument();
    });

    expect(screen.getByText('another-repo')).toBeInTheDocument();
    expect(screen.getByText('Another test repository')).toBeInTheDocument();
    expect(screen.getByText('JavaScript')).toBeInTheDocument();
    expect(screen.getByText('⭐ 10')).toBeInTheDocument();
  });

  it('should handle API error when fetching repositories', async () => {
    const errorMessage = 'Failed to fetch repositories';
    mockApiClient.getRepositories.mockRejectedValueOnce(new Error(errorMessage));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('should call logout when logout button is clicked', async () => {
    mockApiClient.getRepositories.mockResolvedValueOnce({
      data: mockRepositories
    });

    renderDashboard();

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    expect(mockUseAuthStore.logout).toHaveBeenCalled();
  });

  it('should refresh repositories when refresh button is clicked', async () => {
    mockApiClient.getRepositories
      .mockResolvedValueOnce({ data: mockRepositories })
      .mockResolvedValueOnce({ data: [...mockRepositories] });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('test-repo')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    expect(mockApiClient.getRepositories).toHaveBeenCalledTimes(2);
  });

  it('should display "No repositories found" when no repositories exist', async () => {
    mockApiClient.getRepositories.mockResolvedValueOnce({
      data: []
    });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('No repositories found')).toBeInTheDocument();
    });
  });

  it('should show loading state for refresh button during API call', async () => {
    let resolvePromise: (value: any) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockApiClient.getRepositories
      .mockResolvedValueOnce({ data: mockRepositories })
      .mockReturnValueOnce(pendingPromise);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('test-repo')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Resolve the pending promise
    resolvePromise!({ data: mockRepositories });
    
    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });
});