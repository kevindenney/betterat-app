/**
 * BlueprintIndex — thin compat shim.
 *
 * The Phase 10 BlueprintIndex screen has been extracted into the
 * blueprint-agnostic BlueprintIndexScreen + BlueprintStepRow components.
 * This file re-exports the same surface under the old name so the
 * /debug/phase10 + /practice/blueprint/[id] routes keep compiling.
 *
 * @deprecated Import from `@/components/blueprint/BlueprintIndexScreen` instead.
 */

export {
  BlueprintIndexScreen as BlueprintIndex,
} from '@/components/blueprint/BlueprintIndexScreen';

export type {
  BlueprintIndexScreenProps as BlueprintIndexProps,
  BlueprintIndexAuthor,
  BlueprintIndexStep,
} from '@/components/blueprint/BlueprintIndexScreen';
