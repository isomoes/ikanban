/** `command` namespace dictionaries (the popupSelect shell's copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'search.placeholder': '搜索…',
  'search.aria': '筛选选项',
  'status.loading': '正在加载选项…',
  'status.applying': '正在应用…',
  'status.empty': '无选项',
  'overlay.aria': '/{command} 选项',
  'listbox.aria': '/{command} 匹配项',
  'palette.title': '命令面板',
  'palette.placeholder': '搜索操作…',
  'palette.search.aria': '搜索界面操作',
  'palette.list.aria': '界面操作',
  'palette.empty': '无匹配操作',
  'palette.close': '关闭命令面板',
  'notice.imagesUnsupported': '/{command} 不接受图片附件，请先移除图片',
} satisfies Record<string, string>

/** The command namespace key union. */
export type CommandKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'search.placeholder': 'Search…',
  'search.aria': 'Filter options',
  'status.loading': 'Loading options…',
  'status.applying': 'Applying…',
  'status.empty': 'No options',
  'overlay.aria': '/{command} options',
  'listbox.aria': '/{command} matches',
  'palette.title': 'Command Palette',
  'palette.placeholder': 'Search actions…',
  'palette.search.aria': 'Search interface actions',
  'palette.list.aria': 'Interface actions',
  'palette.empty': 'No matching actions',
  'palette.close': 'Close command palette',
  'notice.imagesUnsupported': '/{command} does not accept image attachments; remove them first',
} satisfies Record<CommandKey, string>
