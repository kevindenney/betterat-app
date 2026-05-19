/**
 * Concept detail route — resolves :slug to a concept row and renders detail.
 */
import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ConceptDetail } from '@/components/playbook/concepts/ConceptDetail';

export default function PlaybookConceptDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  if (!slug) return null;
  return <ConceptDetail slug={slug} />;
}
