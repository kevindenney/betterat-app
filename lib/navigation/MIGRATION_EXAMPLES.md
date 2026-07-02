# Migration Examples from the Legacy Codebase

Real examples from the codebase showing how to migrate to type-safe navigation.

## 1. OnboardingCompletion.tsx

### Before
```typescript
// components/onboarding/OnboardingCompletion.tsx:166
router.replace(step.route as any);

// components/onboarding/OnboardingCompletion.tsx:192
router.replace(defaultRoute as any);

// components/onboarding/OnboardingCompletion.tsx:204
router.replace(steps[0].route as any);
```

### After
```typescript
import { navigateTo, type AppRoute } from '@/lib/navigation/routes';

// If step.route is already a valid AppRoute
navigateTo(router, step.route as AppRoute, { replace: true });

// Or better, ensure steps array uses typed routes
const steps = [
  { route: '/(tabs)/races' as const, ... },
  { route: '/(tabs)/dashboard' as const, ... },
];

navigateTo(router, steps[0].route, { replace: true });
```

## 2. ClassSelector.tsx (Dynamic Routes)

### Before
```typescript
// components/sailor/ClassSelector.tsx:130
onPress: () => router.push(`/boat/${boatClass.id}`)

// components/sailor/ClassSelector.tsx:215
router.push(`/boat/${boatClass.id}`);
```

### After
```typescript
import { navigateTo } from '@/lib/navigation/routes';

// Much cleaner and type-safe
onPress: () => navigateTo(router, '/boat/[id]', { id: boatClass.id })

navigateTo(router, '/boat/[id]', { id: boatClass.id });
```

## 3. NavigationHeader.tsx (Static Routes)

### Before
```typescript
// components/navigation/NavigationHeader.tsx:138
<TouchableOpacity onPress={() => router.push('/')}>

// components/navigation/NavigationHeader.tsx:178
onPress={() => router.push('/(auth)/login')}

// components/navigation/NavigationHeader.tsx:188
onPress={() => router.push('/(auth)/signup')}
```

### After
```typescript
import { navigateTo } from '@/lib/navigation/routes';

<TouchableOpacity onPress={() => navigateTo(router, '/')}>

onPress={() => navigateTo(router, '/(auth)/login')}

onPress={() => navigateTo(router, '/(auth)/signup')}
```

## 4. AuthProvider.tsx (Replace Navigation)

### Before
```typescript
// providers/AuthProvider.tsx:454
router.replace('/')

// providers/AuthProvider.tsx:556
router.replace('/')
```

### After
```typescript
import { navigateTo } from '@/lib/navigation/routes';

navigateTo(router, '/', { replace: true })
```

## 5. index.tsx (With Route Helper)

### Before
```typescript
// app/index.tsx:32
const destination = getDashboardRoute(userProfile?.user_type ?? null);
router.replace(destination);
```

### After
```typescript
import { navigateTo, type AppRoute } from '@/lib/navigation/routes';

const destination = getDashboardRoute(userProfile?.user_type ?? null);
navigateTo(router, destination as AppRoute, { replace: true });

// Or update getDashboardRoute to return AppRoute type
// in lib/utils/userTypeRouting.ts - it already returns Href, so it's compatible!
navigateTo(router, destination, { replace: true });
```

## 6. Using with Link Components

### Before
```typescript
<Link href={`/boat/${id}` as any}>View Boat</Link>
<Link href={'/(auth)/login'}>Login</Link>
```

### After
```typescript
import { buildHref } from '@/lib/navigation/routes';

<Link href={buildHref('/boat/[id]', { id })}>View Boat</Link>
<Link href={buildHref('/(auth)/login')}>Login</Link>
```

## Priority Migration Order

Based on the TypeScript remediation plan, tackle in this order:

### Week 1: Auth & Navigation Stack (Priority 1)
1. `providers/AuthProvider.tsx` - 4 instances
2. `components/onboarding/OnboardingCompletion.tsx` - 4 instances
3. `components/navigation/NavigationHeader.tsx` - 5 instances
4. `app/(auth)/*.tsx` files
5. `app/index.tsx`

### Week 2: Race Analysis Domain (Priority 2)
1. `app/race/timer/[id].tsx`
2. `app/race/analysis/[id].tsx`
3. `app/race/simulation/[id].tsx`
4. `app/race-analysis.tsx`

### Week 3: Venue & Component Navigation
1. `components/sailor/ClassSelector.tsx` - 2 instances
2. `components/venue/*.tsx`
3. `components/map/*.tsx`

## Testing Your Migration

After migrating a file, verify:

1. **TypeScript compiles**: `npx tsc --noEmit`
2. **ESLint passes**: `npm run lint`
3. **Runtime works**: Test the navigation paths in the app

## Common Patterns

### Pattern: Conditional Navigation
```typescript
// Before
if (userType === 'coach') {
  router.push('/(tabs)/dashboard');
} else {
  router.push('/(tabs)/races');
}

// After
if (userType === 'coach') {
  navigateTo(router, '/(tabs)/dashboard');
} else {
  navigateTo(router, '/(tabs)/races');
}
```

### Pattern: Navigation with State
```typescript
// Before
const handlePress = () => {
  setLoading(true);
  router.push(`/race/timer/${raceId}`);
};

// After
const handlePress = () => {
  setLoading(true);
  navigateTo(router, '/race/timer/[id]', { id: raceId });
};
```

### Pattern: Back Navigation
```typescript
// Before
router.back();

// After
router.back(); // This is fine as-is, no need to wrap
```

## Finding Migration Targets

Use these commands to find files that need migration:

```bash
# Find all router.push/replace with 'as any'
grep -r "router\.(push|replace).*as any" app components --include="*.tsx"

# Find all router.push/replace with string literals
grep -r "router\.\(push\|replace\)(['\"\`]" app components --include="*.tsx"

# Find all template literal routes
grep -r "router\.\(push\|replace\)(\`" app components --include="*.tsx"

# Count total instances
grep -r "router\.(push|replace)" app components --include="*.tsx" | wc -l
```
