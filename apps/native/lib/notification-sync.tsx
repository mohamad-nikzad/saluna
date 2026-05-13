import * as React from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import type { AppNotification } from '@repo/api-client';
import type { NotificationResponse } from 'expo-notifications';
import { useAuth } from '../components/auth-provider';
import { notificationPreferencesApi, notificationsApi } from './api';

const ANDROID_CHANNEL_ID = 'saloora-local-sync';
const SEEN_STORAGE_PREFIX = 'native:local-alerted-notification-ids:';

type NotificationsModule = typeof import('expo-notifications');

type NotificationSyncContextValue = {
  syncUnreadNotifications: (source?: string) => Promise<void>;
};

const NotificationSyncContext = React.createContext<NotificationSyncContextValue>({
  syncUnreadNotifications: async () => {},
});

let notificationsModule: NotificationsModule | null | undefined;
let notificationsModulePromise: Promise<NotificationsModule | null> | null = null;
let hasConfiguredNotificationHandler = false;

function isNativeNotificationAvailable() {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

function isExpoGoAndroid() {
  return Platform.OS === 'android' && Constants.appOwnership === 'expo';
}

async function loadNotificationsModule(): Promise<NotificationsModule | null> {
  if (!isNativeNotificationAvailable() || isExpoGoAndroid()) return null;
  if (notificationsModule !== undefined) return notificationsModule;
  if (notificationsModulePromise) return notificationsModulePromise;

  notificationsModulePromise = import('expo-notifications')
    .then((module) => {
      notificationsModule = module;
      return notificationsModule;
    })
    .catch(() => {
      notificationsModule = null;
      return notificationsModule;
    })
    .finally(() => {
      notificationsModulePromise = null;
    });

  return notificationsModulePromise;
}

function configureNotificationHandler(notifications: NotificationsModule) {
  if (hasConfiguredNotificationHandler) return;
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  hasConfiguredNotificationHandler = true;
}

function storageKeyForUser(userId: string) {
  return `${SEEN_STORAGE_PREFIX}${userId}`;
}

function getNotificationRoute(notification: AppNotification): string {
  return notification.route && notification.route.startsWith('/')
    ? notification.route
    : '/(tabs)/calendar';
}

function getRouteFromResponse(response: NotificationResponse): string | null {
  const route = response.notification.request.content.data?.route;
  return typeof route === 'string' && route.startsWith('/') ? route : null;
}

function getNotificationIdFromResponse(response: NotificationResponse): string | null {
  const notificationId = response.notification.request.content.data?.notificationId;
  return typeof notificationId === 'string' && notificationId.length > 0 ? notificationId : null;
}

function clearLastNotificationResponse(notifications: NotificationsModule) {
  try {
    notifications.clearLastNotificationResponse();
  } catch {
    // Some dev runtimes do not expose response clearing; routing still works.
  }
}

async function readSeenIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(storageKeyForUser(userId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? new Set(parsed.filter((id): id is string => typeof id === 'string'))
      : new Set();
  } catch {
    return new Set();
  }
}

async function writeSeenIds(userId: string, ids: Set<string>) {
  const trimmed = Array.from(ids).slice(-500);
  await AsyncStorage.setItem(storageKeyForUser(userId), JSON.stringify(trimmed));
}

async function ensureNotificationPermissions(notifications: NotificationsModule) {
  if (!isNativeNotificationAvailable() || isExpoGoAndroid()) return false;

  if (Platform.OS === 'android') {
    await notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Saloora local alerts',
      importance: notifications.AndroidImportance.DEFAULT,
      sound: undefined,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const existing = await notifications.getPermissionsAsync();
  if (
    existing.granted ||
    existing.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }

  const requested = await notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: false,
    },
  });
  return (
    requested.granted || requested.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function scheduleLocalAlert(
  notifications: NotificationsModule,
  notification: AppNotification
) {
  await notifications.scheduleNotificationAsync({
    identifier: `notification:${notification.id}`,
    content: {
      title: notification.title,
      body: notification.body,
      data: {
        notificationId: notification.id,
        route: getNotificationRoute(notification),
      },
      sound: false,
    },
    trigger: Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : null,
  });
}

export function NativeNotificationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const inFlightRef = React.useRef<Promise<void> | null>(null);
  const lastActiveStateRef = React.useRef(AppState.currentState);

  const syncUnreadNotifications = React.useCallback(
    async (_source = 'manual') => {
      const nativeNotifications = await loadNotificationsModule();
      if (!user || !nativeNotifications) return;
      if (inFlightRef.current) return inFlightRef.current;
      configureNotificationHandler(nativeNotifications);

      const run = (async () => {
        const [{ preferences }, { notifications }] = await Promise.all([
          notificationPreferencesApi.get(),
          notificationsApi.list({ unreadOnly: true }),
        ]);

        const unread = notifications.filter((notification) => !notification.readAt);
        if (unread.length === 0) return;

        const seenIds = await readSeenIds(user.id);
        const newlySeen = unread.filter((notification) => !seenIds.has(notification.id));
        if (newlySeen.length === 0) return;

        for (const notification of newlySeen) {
          seenIds.add(notification.id);
        }
        await writeSeenIds(user.id, seenIds);

        if (!preferences.localAlertsEnabled) return;
        const canAlert = await ensureNotificationPermissions(nativeNotifications);
        if (!canAlert) return;

        await Promise.all(
          newlySeen.map((notification) => scheduleLocalAlert(nativeNotifications, notification))
        );
      })();

      inFlightRef.current = run;
      try {
        await run;
      } catch {
        // Local alerts should never block the screen that triggered a refresh.
      } finally {
        inFlightRef.current = null;
      }
    },
    [user]
  );

  React.useEffect(() => {
    if (!user) return;
    void syncUnreadNotifications('launch');
  }, [syncUnreadNotifications, user]);

  React.useEffect(() => {
    if (!user || !isNativeNotificationAvailable() || isExpoGoAndroid()) return;
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasBackgrounded =
        lastActiveStateRef.current === 'background' || lastActiveStateRef.current === 'inactive';
      lastActiveStateRef.current = nextState;
      if (nextState === 'active' && wasBackgrounded) {
        void syncUnreadNotifications('foreground');
      }
    });
    return () => subscription.remove();
  }, [syncUnreadNotifications, user]);

  React.useEffect(() => {
    let isMounted = true;
    let subscription: { remove: () => void } | null = null;

    void loadNotificationsModule().then((notifications) => {
      if (!isMounted || !notifications) return;
      configureNotificationHandler(notifications);

      const openFromResponse = (response: NotificationResponse) => {
        const route = getRouteFromResponse(response);
        if (!route) return;
        const notificationId = getNotificationIdFromResponse(response);
        if (notificationId) {
          void notificationsApi.markRead(notificationId).catch(() => undefined);
        }
        router.push(route as never);
      };

      let latestResponse: NotificationResponse | null = null;
      try {
        latestResponse = notifications.getLastNotificationResponse();
      } catch {
        latestResponse = null;
      }
      if (latestResponse) {
        openFromResponse(latestResponse);
        clearLastNotificationResponse(notifications);
      }

      subscription = notifications.addNotificationResponseReceivedListener((response) => {
        openFromResponse(response);
        clearLastNotificationResponse(notifications);
      });
    });

    return () => {
      isMounted = false;
      subscription?.remove();
    };
  }, [router]);

  const value = React.useMemo(() => ({ syncUnreadNotifications }), [syncUnreadNotifications]);

  return (
    <NotificationSyncContext.Provider value={value}>{children}</NotificationSyncContext.Provider>
  );
}

export function useNotificationSync() {
  return React.useContext(NotificationSyncContext);
}
