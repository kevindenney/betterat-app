import { useCallback, useMemo, useState } from 'react';
import { invokeAIEdgeFunction } from '@/services/ai/invokeAIEdgeFunction';

export type ClaudeDocumentType =
  | 'nor'
  | 'si'
  | 'amendment'
  | 'notice'
  | 'course_map'
  | 'results'
  | 'other';

export interface ClaudeDocumentDraft {
  title: string;
  markdown: string;
  sections: { heading: string; body: string }[];
  confidence: number | null;
}

export interface UseClaudeDraftOptions {
  eventId: string | null;
  documentType?: ClaudeDocumentType;
  enabled?: boolean;
}

export interface UseClaudeDraftReturn {
  draft: ClaudeDocumentDraft | null;
  isGenerating: boolean;
  error: string | null;
  generate: (overrides?: { documentType?: ClaudeDocumentType }) => Promise<ClaudeDocumentDraft | null>;
  reset: () => void;
  lastGeneratedAt: Date | null;
  documentType: ClaudeDocumentType;
  setDocumentType: (type: ClaudeDocumentType) => void;
}

export function useClaudeDraft(options: UseClaudeDraftOptions): UseClaudeDraftReturn {
  const { eventId, documentType: initialType = 'nor', enabled = true } = options;
  const [draft, setDraft] = useState<ClaudeDocumentDraft | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [documentType, setDocumentType] = useState<ClaudeDocumentType>(initialType);

  const ready = useMemo(() => enabled && !!eventId, [enabled, eventId]);

  const reset = useCallback(() => {
    setDraft(null);
    setError(null);
    setLastGeneratedAt(null);
  }, []);

  const generate = useCallback(
    async (overrides?: { documentType?: ClaudeDocumentType }) => {
      if (!ready) {
        setError('Event context not ready yet.');
        return null;
      }

      const targetType = overrides?.documentType ?? documentType;
      setDocumentType(targetType);

      setIsGenerating(true);
      setError(null);

      try {
        const { data: payload, error: invokeError } = await invokeAIEdgeFunction<
          ClaudeDocumentDraft & { error?: string }
        >('ai-event-document-draft', {
          body: { eventId, document_type: targetType },
        });

        if (invokeError || !payload || payload.error) {
          throw new Error(invokeError?.message || payload?.error || 'Unable to generate draft');
        }

        const nextDraft: ClaudeDocumentDraft = {
          title: payload.title,
          markdown: payload.markdown,
          sections: Array.isArray(payload.sections) ? payload.sections : [],
          confidence: typeof payload.confidence === 'number' ? payload.confidence : null,
        };

        setDraft(nextDraft);
        setLastGeneratedAt(new Date());
        return nextDraft;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [documentType, eventId, ready]
  );

  return {
    draft,
    isGenerating,
    error,
    generate,
    reset,
    lastGeneratedAt,
    documentType,
    setDocumentType,
  };
}
