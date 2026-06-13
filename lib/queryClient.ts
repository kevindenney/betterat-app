import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: (failureCount, error) => {
        const status = (error as any)?.status ?? (error as any)?.code;
        if (typeof status === 'number' && status >= 400 && status < 500) return false;

        const msg = (error as any)?.message ?? '';
        if (/\b4\d{2}\b/.test(msg)) return false;

        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
  },
});
