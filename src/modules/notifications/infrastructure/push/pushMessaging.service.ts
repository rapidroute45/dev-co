import type { Message } from 'firebase-admin/messaging';
import { ENV } from '../../../../config/env';
import { getFirebaseMessaging, isFirebaseConfigured } from '../../../../shared/firebase/firebaseAdmin';
import { NotificationType } from '../../domain/entities/notification.entity';
import { DeviceToken, SUPPORTED_PUSH_PLATFORMS } from '../../domain/entities/deviceToken.entity';
import { IDeviceTokenRepository } from '../../domain/interfaces/device-token-repository.interface';

export type PushSendInput = {
  recipientIds: string[];
  title: string;
  body: string;
  type: NotificationType;
  payload: Record<string, unknown>;
};

export type PushBroadcastInput = {
  title: string;
  body: string;
  type: NotificationType;
  payload: Record<string, unknown>;
};

export type PushSendResult = {
  sent: number;
  failed: number;
  skipped: number;
  tokenCount?: number;
};

const ANDROID_CHANNEL_DEFAULT = 'dispatch_default';
const ANDROID_CHANNEL_ROUTES = 'dispatch_routes';
const ANDROID_CHANNEL_OPS = 'dispatch_ops';
const ANDROID_CHANNEL_PAYROLL = 'dispatch_payroll';
const ANDROID_CHANNEL_CHAT = 'dispatch_chat';

function androidChannelForType(type: NotificationType): string {
  switch (type) {
    case NotificationType.ROUTE_OFFER:
    case NotificationType.ROUTE_ASSIGNED:
    case NotificationType.ROUTE_NEEDS_DRIVER:
      return ANDROID_CHANNEL_ROUTES;
    case NotificationType.ROUTE_OPS_REVIEW:
    case NotificationType.SCHEDULE_CREATED:
    case NotificationType.SCHEDULE_UPDATED:
    case NotificationType.ROUTE_CREATED:
    case NotificationType.ROUTE_UPDATED:
    case NotificationType.DISPATCH_TEAM_UPDATED:
    case NotificationType.DRIVER_DWELLING:
    case NotificationType.STOP_AUTO_COMPLETED:
      return ANDROID_CHANNEL_OPS;
    case NotificationType.PAYROLL_GENERATED:
    case NotificationType.PAYROLL_SENT:
    case NotificationType.PAYROLL_APPROVED:
      return ANDROID_CHANNEL_PAYROLL;
    case NotificationType.CHAT_MESSAGE:
      return ANDROID_CHANNEL_CHAT;
    case NotificationType.DOCUMENT_REQUIRED:
    case NotificationType.DOCUMENT_UPDATED:
    case NotificationType.DOCUMENT_VERIFIED:
    case NotificationType.DOCUMENT_REJECTED:
      return ANDROID_CHANNEL_DEFAULT;
    default:
      return ANDROID_CHANNEL_DEFAULT;
  }
}

function stringifyDataPayload(
  type: NotificationType,
  payload: Record<string, unknown>
): Record<string, string> {
  const data: Record<string, string> = { type };

  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;
    data[key] = typeof value === 'string' ? value : JSON.stringify(value);
  }

  if (!data.deepLink && typeof payload.routeId === 'string') {
    data.deepLink = `/routes/tracking/${payload.routeId}`;
  }

  return data;
}

function isStaleTokenError(code?: string): boolean {
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}

function webPushClickLink(data: Record<string, string>): string | undefined {
  const path = data.deepLink?.startsWith('/') ? data.deepLink : `/${data.deepLink || ''}`;
  if (!ENV.WEB_APP_ORIGIN) return undefined;
  return `${ENV.WEB_APP_ORIGIN}${path}`;
}

function buildFcmMessage(
  entry: DeviceToken,
  input: PushBroadcastInput,
  data: Record<string, string>,
  title: string,
  body: string
): Message {
  const base: Message = {
    token: entry.token,
    notification: { title, body },
    data,
  };

  if (entry.platform === 'web') {
    const link = webPushClickLink(data);
    return {
      ...base,
      webpush: {
        notification: { title, body },
        ...(link ? { fcmOptions: { link } } : {}),
      },
    };
  }

  return {
    ...base,
    android: {
      priority: 'high',
      notification: {
        channelId: androidChannelForType(input.type),
      },
    },
  };
}

export class PushMessagingService {
  constructor(private deviceTokenRepo: IDeviceTokenRepository) {}

  /** Send push to every registered device token (all users). */
  async sendBroadcast(input: PushBroadcastInput): Promise<PushSendResult> {
    if (!isFirebaseConfigured()) {
      console.warn('[push] Broadcast skipped — Firebase not configured');
      return { sent: 0, failed: 0, skipped: 0, tokenCount: 0 };
    }

    const tokens = (
      await Promise.all(
        SUPPORTED_PUSH_PLATFORMS.map((platform) =>
          this.deviceTokenRepo.findAllByPlatform(platform)
        )
      )
    ).flat();

    if (tokens.length === 0) {
      console.warn('[push] Broadcast skipped — no device tokens registered');
      return { sent: 0, failed: 0, skipped: 0, tokenCount: 0 };
    }

    console.log('[push] Broadcasting test notification', {
      tokenCount: tokens.length,
      uniqueUsers: new Set(tokens.map((t) => t.userId)).size,
    });

    return this.deliverToTokens(tokens, input);
  }

  async sendToRecipients(input: PushSendInput): Promise<PushSendResult> {
    if (!isFirebaseConfigured()) {
      return { sent: 0, failed: 0, skipped: input.recipientIds.length };
    }

    const messaging = getFirebaseMessaging();
    if (!messaging) {
      return { sent: 0, failed: 0, skipped: input.recipientIds.length };
    }

    const tokens = (
      await Promise.all(
        SUPPORTED_PUSH_PLATFORMS.map((platform) =>
          this.deviceTokenRepo.findByUserIds(input.recipientIds, platform)
        )
      )
    ).flat();

    if (tokens.length === 0) {
      return { sent: 0, failed: 0, skipped: input.recipientIds.length };
    }

    return this.deliverToTokens(tokens, input);
  }

  private async deliverToTokens(
    tokens: DeviceToken[],
    input: PushBroadcastInput
  ): Promise<PushSendResult> {
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      return { sent: 0, failed: 0, skipped: tokens.length, tokenCount: tokens.length };
    }

    const data = stringifyDataPayload(input.type, input.payload);
    const title = input.title;
    const body = input.body;
    const messages: Message[] = tokens.map((entry) =>
      buildFcmMessage(entry, input, data, title, body)
    );

    const batch = await messaging.sendEach(messages);

    let sent = 0;
    let failed = 0;
    let sentAndroid = 0;
    let sentWeb = 0;

    for (let i = 0; i < batch.responses.length; i += 1) {
      const response = batch.responses[i];
      const tokenEntry = tokens[i];
      if (!response || !tokenEntry) continue;

      if (response.success) {
        sent += 1;
        if (tokenEntry.platform === 'web') sentWeb += 1;
        else sentAndroid += 1;
        continue;
      }

      failed += 1;
      const code = response.error?.code;
      if (isStaleTokenError(code)) {
        await this.deviceTokenRepo.removeByTokenValue(tokenEntry.token);
        console.warn('[push] Removed stale token', {
          userId: tokenEntry.userId,
          platform: tokenEntry.platform,
          code,
        });
      } else {
        console.warn('[push] FCM send failed', {
          userId: tokenEntry.userId,
          platform: tokenEntry.platform,
          code,
          message: response.error?.message,
        });
      }
    }

    if (sent > 0) {
      console.log('[push] Notifications sent', {
        type: input.type,
        sent,
        sentAndroid,
        sentWeb,
        failed,
        tokenCount: tokens.length,
      });
    }

    return { sent, failed, skipped: 0, tokenCount: tokens.length };
  }
}
