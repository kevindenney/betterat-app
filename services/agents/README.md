# BetterAt AI Agents

This directory contains autonomous AI agents powered by Anthropic's Claude SDK. These agents use tool-calling to orchestrate complex multi-step workflows.

## 🚨 IMPORTANT: Security Best Practices

**Agents MUST ONLY run server-side.** Never instantiate agents directly in browser/mobile code.

### ❌ WRONG - Exposes API Keys
```typescript
// In browser/React Native component
import { DocumentProcessingAgent } from '@/src/services/agents';

function MyComponent() {
  const agent = new DocumentProcessingAgent(); // ❌ DANGEROUS!

  const handleUpload = async (text: string) => {
    const result = await agent.run({ userMessage: text }); // ❌ Exposes API key
  };
}
```

### ✅ CORRECT - Secure Server-Side Execution
```typescript
// 1. Create Supabase Edge Function (server-side)
// File: supabase/functions/process-document/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { DocumentProcessingAgent } from './agents/DocumentProcessingAgent.ts';

serve(async (req) => {
  const { text } = await req.json();

  const agent = new DocumentProcessingAgent(); // ✅ Safe - runs server-side
  const result = await agent.run({ userMessage: text });

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' }
  });
});

// 2. Call from browser/React Native
// File: src/components/MyComponent.tsx
import { supabase } from '@/src/services/supabase';

function MyComponent() {
  const handleUpload = async (text: string) => {
    const { data, error } = await supabase.functions.invoke('process-document', {
      body: { text }
    }); // ✅ Secure - API key stays on server
  };
}
```

## Available Agents

### 1. **ComprehensiveRaceExtractionAgent**
- **Purpose**: Extract race details from sailing instructions
- **Edge Function**: `supabase/functions/extract-race-details`
- **Usage**: Race entry forms, document uploads

### 2. **DocumentProcessingAgent**
- **Purpose**: Parse sailing documents (PDFs, URLs)
- **Status**: ⚠️ Needs Edge Function
- **Todo**: Create `supabase/functions/process-sailing-document`

### 3. **RaceAnalysisAgent**
- **Purpose**: Analyze race performance and strategy
- **Status**: ⚠️ Needs Edge Function
- **Todo**: Create `supabase/functions/analyze-race`

### 4. **VenueIntelligenceAgent**
- **Purpose**: GPS venue detection and intelligence loading
- **Status**: ⚠️ Needs Edge Function
- **Todo**: Create `supabase/functions/detect-venue`

### 5. **CoachMatchingAgent**
- **Purpose**: Match sailors with coaches based on performance
- **Status**: ⚠️ Needs Edge Function
- **Todo**: Create `supabase/functions/match-coach`

### 6. **ConversationalOnboardingAgent**
- **Purpose**: Interactive onboarding conversations
- **Status**: ⚠️ Needs Edge Function
- **Todo**: Create `supabase/functions/onboarding-chat`

### 7. **RaceExtractionAgent** (Legacy)
- **Note**: Consider migrating to ComprehensiveRaceExtractionAgent

### 8. **CoursePredictionAgent**
- **Purpose**: Predict race courses from conditions
- **Status**: ⚠️ Needs Edge Function

### 9. **ClubOnboardingAgent** & **OnboardingAgent**
- **Purpose**: Club and general onboarding workflows
- **Status**: ⚠️ Need Edge Functions

## Creating a New Agent Edge Function

### Step 1: Create Edge Function Directory
```bash
mkdir -p supabase/functions/my-agent
```

### Step 2: Create Edge Function Handler
```typescript
// supabase/functions/my-agent/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { input } = await req.json();

    // Call Anthropic API directly (without agent SDK for simpler cases)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: [{ role: 'user', content: input }],
      }),
    });

    const data = await response.json();

    return new Response(JSON.stringify({ success: true, data }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Step 3: Deploy Edge Function
```bash
npx supabase functions deploy my-agent
```

### Step 4: Set Secrets (if not already set)
```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### Step 5: Call from Client
```typescript
import { supabase } from '@/src/services/supabase';

const { data, error } = await supabase.functions.invoke('my-agent', {
  body: { input: 'Process this data...' }
});
```

## Environment Detection

`BaseAgentService` automatically detects browser environments and throws an error:

```typescript
if (Platform.OS === 'web' || typeof window !== 'undefined') {
  throw new Error('BaseAgentService cannot run in browser');
}
```

This prevents accidental API key exposure.

## Migration Checklist

For each agent that might be called from browser code:

- [ ] ✅ ComprehensiveRaceExtractionAgent → `extract-race-details`
- [ ] ⚠️ DocumentProcessingAgent → needs Edge Function
- [ ] ⚠️ RaceAnalysisAgent → needs Edge Function
- [ ] ⚠️ VenueIntelligenceAgent → needs Edge Function
- [ ] ⚠️ CoachMatchingAgent → needs Edge Function
- [ ] ⚠️ ConversationalOnboardingAgent → needs Edge Function
- [ ] ⚠️ CoursePredictionAgent → needs Edge Function
- [ ] ⚠️ ClubOnboardingAgent → needs Edge Function
- [ ] ⚠️ OnboardingAgent → needs Edge Function

## Testing

### Test Edge Function Locally
```bash
npx supabase functions serve my-agent
```

### Test Edge Function Call
```typescript
// In browser console or test file
const { data, error } = await supabase.functions.invoke('my-agent', {
  body: { input: 'test' }
});
console.log(data, error);
```

## Security Notes

1. **Never expose API keys**: Always use Edge Functions for AI operations
2. **Validate auth**: Check `Authorization` header in Edge Functions
3. **Rate limiting**: Consider implementing rate limits for production
4. **Error handling**: Never return API keys or sensitive data in error messages
5. **CORS**: Only allow necessary origins in production

## Further Reading

- [Anthropic SDK Documentation](https://docs.anthropic.com/claude/reference/client-sdks)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [BetterAt Agent Architecture](../../../docs/ai-agent-architecture.md)
