/** `settings.reminders` namespace dictionaries. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'title': '提醒音效',
  'description': '会话需要你处理或完成时播放声音',
  'completion': '会话完成',
  'completion.description': '运行中的会话完成时播放提示音',
  'attention': '需要处理',
  'attention.description': '会话等待审批、计划确认或问题回答时播放提示音',
} satisfies Record<string, string>

/** Reminder settings key union. */
export type ReminderKey = keyof typeof zh

/** English dictionary, checked complete against the Chinese key set. */
export const en = {
  'title': 'Reminder sounds',
  'description': 'Play a sound when a session needs you or finishes',
  'completion': 'Session finished',
  'completion.description': 'Play a chime when a running session finishes',
  'attention': 'Needs attention',
  'attention.description': 'Play an alert for approvals, plan reviews, and questions',
} satisfies Record<ReminderKey, string>
