/**
 * PushNotificationHandler - Global push notification setup component
 *
 * This component should be placed at the root of the app (inside AuthProvider
 * and ToastProvider) to handle push notification registration and navigation.
 *
 * Features:
 * - Auto-registers for push notifications when user is authenticated
 * - Handles notification taps to navigate to relevant screens
 * - Shows foreground notifications as in-app toasts (cross-platform)
 * - Supports coaching deep links via `route` field in notification data
 */

import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useToast } from '@/components/ui/AppToast';
import { logger } from '@/lib/logger';

// BUG 29: Allowlist of valid route prefixes for deep link navigation
const ALLOWED_ROUTE_PREFIXES = [
  '/coach/',
  '/(tabs)/',
  '/race/',
  '/profile/',
  '/crew-thread/',
  '/social-notifications',
  '/learn/',
  '/club/',
  '/settings',
];

/** Check if a deep link route matches the allowlist */
function isAllowedRoute(route: string): boolean {
  return ALLOWED_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix));
}

interface PushNotificationHandlerProps {
  /** Whether to show toasts for foreground notifications */
  showForegroundAlerts?: boolean;
  children?: React.ReactNode;
}

export function PushNotificationHandler({
  showForegroundAlerts = true,
  children,
}: PushNotificationHandlerProps) {
  const router = useRouter();
  const toast = useToast();

  // Handle notification tap - navigate to appropriate screen
  const handleNotificationTapped = useCallback(
    (data: Record<string, any>) => {
      // Coaching notifications include a `route` field for deep linking
      if (data.route) {
        // BUG 29: Validate route against allowlist to prevent arbitrary navigation
        if (!isAllowedRoute(data.route)) {
          console.warn('[Push] Blocked navigation to unallowed route:', data.route);
          return;
        }
        router.push(data.route as any);
        return;
      }

      // Handle crew thread notifications
      if (data.thread_id) {
        router.push(`/crew-thread/${data.thread_id}`);
        return;
      }

      // Handle race notifications
      if (data.regatta_id) {
        router.push(`/race/${data.regatta_id}`);
        return;
      }

      // Handle profile-related notifications
      if (data.actor_id && data.type === 'new_follower') {
        router.push(`/profile/${data.actor_id}`);
        return;
      }

      // Default: go to notifications list
      if (data.type) {
        router.push('/social-notifications');
      }
    },
    [router]
  );

  // Handle foreground notification - show in-app toast
  const handleNotificationReceived = useCallback(
    (notification: any) => {
      if (!showForegroundAlerts) return;

      const title = notification?.request?.content?.title;
      const body = notification?.request?.content?.body;
      const data = notification?.request?.content?.data || {};

      // Don't show toast for crew thread messages on iOS (use native banner)
      if (Platform.OS === 'ios' && data.thread_id && !data.route) {
        return;
      }

      if (title) {
        // Show a brief toast with the notification title and body
        const message = body ? `${title}: ${body}` : title;
        toast.show(message, 'info');
      }
    },
    [showForegroundAlerts, toast]
  );

  // Initialize push notifications
  const { isEnabled, error } = usePushNotifications({
    onNotificationTapped: handleNotificationTapped,
    onNotificationReceived: handleNotificationReceived,
    autoRegister: true,
  });

  // Log registration status (for debugging)
  useEffect(() => {
    if (isEnabled) {
      logger.debug('[Push] Notifications registered successfully');
    } else if (error) {
      logger.debug('[Push] Registration failed:', error);
    }
  }, [isEnabled, error]);

  // This component doesn't render anything itself
  return children ?? null;
}

export default PushNotificationHandler;
