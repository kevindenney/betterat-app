/**
 * useVenueDocuments - React Query hooks for venue knowledge documents
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  VenueDocumentService,
  UploadDocumentParams,
  CreateInsightParams,
  InsightCategory,
} from '@/services/venue/VenueDocumentService';

// Query keys
export const documentKeys = {
  all: ['venue-documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  list: (venueId: string, filters?: {
    sortBy?: string;
    raceRouteId?: string | null;
  }) => [...documentKeys.lists(), venueId, filters] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (documentId: string) => [...documentKeys.details(), documentId] as const,
  insights: () => [...documentKeys.all, 'insights'] as const,
  insightsList: (venueId: string, filters?: { documentId?: string; category?: InsightCategory }) =>
    [...documentKeys.insights(), venueId, filters] as const,
  freshness: (contentType: string, contentId: string) =>
    [...documentKeys.all, 'freshness', contentType, contentId] as const,
};

/**
 * Fetch documents for a venue
 */
export function useVenueDocuments(
  venueId: string,
  options: {
    raceRouteId?: string | null;
    sortBy?: 'recent' | 'popular';
    limit?: number;
    enabled?: boolean;
  } = {}
) {
  const {
    raceRouteId,
    sortBy = 'recent',
    limit = 20,
    enabled = true
  } = options;

  return useQuery({
    queryKey: documentKeys.list(venueId, { sortBy, raceRouteId }),
    queryFn: async () => {
      const result = await VenueDocumentService.getDocuments(venueId, {
        raceRouteId,
        sortBy,
        limit,
      });
      return result;
    },
    enabled: enabled && !!venueId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch a single document
 */
export function useVenueDocument(documentId: string, enabled = true) {
  return useQuery({
    queryKey: documentKeys.detail(documentId),
    queryFn: async () => {
      const document = await VenueDocumentService.getDocument(documentId);
      return document;
    },
    enabled: enabled && !!documentId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Fetch insights for a venue
 */
export function useVenueInsights(
  venueId: string,
  options: {
    documentId?: string;
    category?: InsightCategory;
    limit?: number;
    enabled?: boolean;
  } = {}
) {
  const { documentId, category, limit = 50, enabled = true } = options;

  return useQuery({
    queryKey: documentKeys.insightsList(venueId, { documentId, category }),
    queryFn: async () => {
      const result = await VenueDocumentService.getInsights(venueId, {
        documentId,
        category,
        limit,
      });
      return result;
    },
    enabled: enabled && !!venueId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Upload a document
 */
export function useUploadDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UploadDocumentParams) => {
      return VenueDocumentService.uploadDocument(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.lists(),
      });
    },
  });
}

/**
 * Delete a document
 */
export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      documentId,
    }: {
      documentId: string;
      venueId: string;
    }) => {
      return VenueDocumentService.deleteDocument(documentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.lists(),
      });
    },
  });
}

/**
 * Create an insight
 */
export function useCreateInsight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateInsightParams) => {
      return VenueDocumentService.createInsight(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.insights(),
      });
    },
  });
}

/**
 * Verify/dispute an insight
 */
export function useVerifyInsight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      insightId,
      verified,
    }: {
      insightId: string;
      verified: boolean;
      venueId: string;
    }) => {
      return VenueDocumentService.verifyInsight(insightId, verified);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.insightsList(variables.venueId, {}),
      });
    },
  });
}

/**
 * Mark content freshness
 */
export function useMarkFreshness() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contentType,
      contentId,
      status,
      notes,
    }: {
      contentType: 'document' | 'insight' | 'tip';
      contentId: string;
      status: 'still_accurate' | 'needs_update' | 'outdated';
      notes?: string;
    }) => {
      return VenueDocumentService.markFreshness(contentType, contentId, status, notes);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.freshness(variables.contentType, variables.contentId),
      });
    },
  });
}

/**
 * Get freshness status
 */
export function useFreshness(
  contentType: 'document' | 'insight' | 'tip',
  contentId: string,
  enabled = true
) {
  return useQuery({
    queryKey: documentKeys.freshness(contentType, contentId),
    queryFn: async () => {
      return VenueDocumentService.getFreshness(contentType, contentId);
    },
    enabled: enabled && !!contentId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get insight categories
 */
export function useInsightCategories() {
  return VenueDocumentService.getInsightCategories();
}
