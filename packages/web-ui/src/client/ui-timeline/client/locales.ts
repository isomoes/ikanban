export const zh = {
  'command.description': '回到较早的消息并从修改后的内容重新开始',
  'option.turn': '第 {turn} 轮',
} as const

export const en = {
  'command.description': 'Return to an earlier message and restart from edited input',
  'option.turn': 'Turn {turn}',
} as const

export type TimelineKey = keyof typeof en
