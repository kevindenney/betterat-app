/**
 * useDrillLibrary Hook
 *
 * Provides access to the drill library with filtering and search.
 * Uses TanStack Query for caching.
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { drillLibraryService, DrillFilterOptions } from '@/services/DrillLibraryService';
import {
  Drill,
  DrillCategory,
  DrillDifficulty,
  SkillArea,
  DrillSkillMapping,
} from '@/types/practice';

// Query keys
export const DRILL_QUERY_KEYS = {
  all: ['drills'] as const,
  list: () => [...DRILL_QUERY_KEYS.all, 'list'] as const,
  filtered: (filters: DrillFilterOptions) => [...DRILL_QUERY_KEYS.all, 'filtered', filters] as const,
  byCategory: (category: DrillCategory) => [...DRILL_QUERY_KEYS.all, 'category', category] as const,
  bySkillArea: (skillArea: SkillArea) => [...DRILL_QUERY_KEYS.all, 'skill', skillArea] as const,
  single: (idOrSlug: string) => [...DRILL_QUERY_KEYS.all, idOrSlug] as const,
  search: (query: string) => [...DRILL_QUERY_KEYS.all, 'search', query] as const,
  withInteractives: () => [...DRILL_QUERY_KEYS.all, 'with-interactives'] as const,
  categories: () => [...DRILL_QUERY_KEYS.all, 'categories'] as const,
  difficulties: () => [...DRILL_QUERY_KEYS.all, 'difficulties'] as const,
};

interface UseDrillLibraryOptions {
  initialCategory?: DrillCategory;
  initialDifficulty?: DrillDifficulty;
  initialSkillArea?: SkillArea;
}

interface UseDrillLibraryReturn {
  // Data
  drills: Drill[];
  filteredDrills: Drill[];
  categories: { category: DrillCategory; count: number }[];
  difficulties: { difficulty: DrillDifficulty; count: number }[];

  // Filters
  selectedCategory: DrillCategory | null;
  selectedDifficulty: DrillDifficulty | null;
  selectedSkillArea: SkillArea | null;
  searchQuery: string;

  // Loading states
  isLoading: boolean;
  isSearching: boolean;

  // Errors
  error: Error | null;

  // Filter actions
  setCategory: (category: DrillCategory | null) => void;
  setDifficulty: (difficulty: DrillDifficulty | null) => void;
  setSkillArea: (skillArea: SkillArea | null) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;

  // Data actions
  getDrill: (idOrSlug: string) => Promise<Drill | null>;
  getDrillsForSkillArea: (skillArea: SkillArea) => Promise<Drill[]>;
  getDrillsWithInteractives: () => Promise<Drill[]>;
  getSkillMappings: (drillId: string) => Promise<DrillSkillMapping[]>;
}

/**
 * Hook to browse and filter the drill library
 */
export function useDrillLibrary(
  options: UseDrillLibraryOptions = {}
): UseDrillLibraryReturn {
  const { initialCategory, initialDifficulty, initialSkillArea } = options;

  // Filter state
  const [selectedCategory, setCategory] = useState<DrillCategory | null>(
    initialCategory || null
  );
  const [selectedDifficulty, setDifficulty] = useState<DrillDifficulty | null>(
    initialDifficulty || null
  );
  const [selectedSkillArea, setSkillArea] = useState<SkillArea | null>(
    initialSkillArea || null
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Build filter options
  const filterOptions: DrillFilterOptions = useMemo(
    () => ({
      category: selectedCategory || undefined,
      difficulty: selectedDifficulty || undefined,
      skillArea: selectedSkillArea || undefined,
      search: searchQuery || undefined,
    }),
    [selectedCategory, selectedDifficulty, selectedSkillArea, searchQuery]
  );

  // Fetch all drills
  const {
    data: allDrills = [],
    isLoading: isLoadingAll,
    error: allError,
  } = useQuery({
    queryKey: DRILL_QUERY_KEYS.list(),
    queryFn: () => drillLibraryService.getAllDrills(),
    staleTime: 5 * 60 * 1000, // 5 minutes - drills don't change often
  });

  // Fetch filtered drills (when filters are active)
  const hasFilters = !!(
    selectedCategory || selectedDifficulty || selectedSkillArea || searchQuery
  );

  const {
    data: filteredFromServer = [],
    isLoading: isLoadingFiltered,
    error: filteredError,
  } = useQuery({
    queryKey: DRILL_QUERY_KEYS.filtered(filterOptions),
    queryFn: () => drillLibraryService.getDrills(filterOptions),
    enabled: hasFilters,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Use server-filtered results if filters active, otherwise all drills
  const drills = hasFilters ? filteredFromServer : allDrills;

  // Client-side filtering for quick search (as user types)
  const filteredDrills = useMemo(() => {
    if (!searchQuery) return drills;
    const query = searchQuery.toLowerCase();
    return drills.filter(
      (d) =>
        d.name.toLowerCase().includes(query) ||
        d.description.toLowerCase().includes(query) ||
        d.tags.some((t) => t.toLowerCase().includes(query))
    );
  }, [drills, searchQuery]);

  // Fetch categories with counts
  const { data: categories = [] } = useQuery({
    queryKey: DRILL_QUERY_KEYS.categories(),
    queryFn: () => drillLibraryService.getCategoriesWithCounts(),
    staleTime: 5 * 60 * 1000,
  });

  // Fetch difficulties with counts
  const { data: difficulties = [] } = useQuery({
    queryKey: DRILL_QUERY_KEYS.difficulties(),
    queryFn: () => drillLibraryService.getDifficultiesWithCounts(),
    staleTime: 5 * 60 * 1000,
  });

  // Clear all filters
  const clearFilters = useCallback(() => {
    setCategory(null);
    setDifficulty(null);
    setSkillArea(null);
    setSearchQuery('');
  }, []);

  // Get a single drill by ID or slug
  const getDrill = useCallback(
    (idOrSlug: string) => drillLibraryService.getDrill(idOrSlug),
    []
  );

  // Get drills for a specific skill area
  const getDrillsForSkillArea = useCallback(
    (skillArea: SkillArea) => drillLibraryService.getDrillsForSkillArea(skillArea),
    []
  );

  // Get drills with learning interactives
  const getDrillsWithInteractives = useCallback(
    () => drillLibraryService.getDrillsWithInteractives(),
    []
  );

  // Get skill mappings for a drill
  const getSkillMappings = useCallback(
    (drillId: string) => drillLibraryService.getSkillMappingsForDrill(drillId),
    []
  );

  return {
    // Data
    drills: allDrills,
    filteredDrills,
    categories,
    difficulties,

    // Filters
    selectedCategory,
    selectedDifficulty,
    selectedSkillArea,
    searchQuery,

    // Loading states
    isLoading: isLoadingAll,
    isSearching: isLoadingFiltered,

    // Errors
    error: (allError || filteredError) as Error | null,

    // Filter actions
    setCategory,
    setDifficulty,
    setSkillArea,
    setSearchQuery,
    clearFilters,

    // Data actions
    getDrill,
    getDrillsForSkillArea,
    getDrillsWithInteractives,
    getSkillMappings,
  };
}

/**
 * Hook to get a single drill by ID or slug
 */
export function useDrill(idOrSlug: string | null) {
  return useQuery({
    queryKey: DRILL_QUERY_KEYS.single(idOrSlug || ''),
    queryFn: () => (idOrSlug ? drillLibraryService.getDrill(idOrSlug) : null),
    enabled: !!idOrSlug,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get drills recommended for a skill area
 */
export function useDrillsForSkillArea(skillArea: SkillArea | null) {
  return useQuery({
    queryKey: DRILL_QUERY_KEYS.bySkillArea(skillArea || 'start-execution'),
    queryFn: () =>
      skillArea ? drillLibraryService.getDrillsForSkillArea(skillArea) : [],
    enabled: !!skillArea,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to search drills
 */
export function useDrillSearch(query: string) {
  return useQuery({
    queryKey: DRILL_QUERY_KEYS.search(query),
    queryFn: () => (query.length >= 2 ? drillLibraryService.searchDrills(query) : []),
    enabled: query.length >= 2,
    staleTime: 30 * 1000,
  });
}
