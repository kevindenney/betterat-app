// Root-level alias for the Atlas screen so the location picker stacks ON TOP
// of /step/[id] instead of popping it (pushing the tab route '/(tabs)/atlas'
// pops the step screen, which unmounts StepShell and kills its
// AtlasPickerBus subscription — the picked location was never applied).
export { default } from './(tabs)/atlas';
