import type { ReplyKeyboardMarkup } from 'grammy/types'

/** Labels on the persistent reply keyboard. Used for both rendering and inbound matching. */
export const REPLY_KEYBOARD_LABELS = {
  pending: '📋 درخواست‌های در انتظار',
  today: '📅 امروز',
  notificationSettings: '⚙️ تنظیمات اعلان‌ها',
} as const

export function persistentReplyKeyboard(): ReplyKeyboardMarkup {
  return {
    keyboard: [
      [
        { text: REPLY_KEYBOARD_LABELS.pending },
        { text: REPLY_KEYBOARD_LABELS.today },
      ],
      [{ text: REPLY_KEYBOARD_LABELS.notificationSettings }],
    ],
    is_persistent: true,
    resize_keyboard: true,
  }
}
