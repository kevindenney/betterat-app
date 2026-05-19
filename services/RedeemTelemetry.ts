import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('RedeemTelemetry');

export type RedeemEvent =
  | { name: 'redeem_attempted'; token: string; success: boolean }
  | { name: 'redeem_completed'; token: string; userId: string; blueprintId: string }
  | { name: 'first_step_written'; userId: string; stepId: string }
  | { name: 'install_banner_shown'; page: string }
  | { name: 'install_clicked'; page: string }
  | { name: 'install_deferred'; page: string };

export function trackRedeemEvent(event: RedeemEvent): void {
  // Lightweight client-side telemetry hook. Routes to console + downstream
  // analytics pipelines via the logger; replace with the project-wide analytics
  // dispatcher when one lands.
  logger.info('redeem_event', event);
  try {
    const w = globalThis as unknown as {
      dataLayer?: unknown[];
      analytics?: { track?: (name: string, props: Record<string, unknown>) => void };
    };
    if (w.analytics?.track) {
      const { name, ...rest } = event as { name: string } & Record<string, unknown>;
      w.analytics.track(name, rest);
    }
    if (w.dataLayer) {
      w.dataLayer.push({ event: event.name, ...event });
    }
  } catch {
    // Best-effort — telemetry never blocks user flow.
  }
}
