import { styleText } from 'node:util'

export type Style = Parameters<typeof styleText>[0]

export function paint(style: Style, text: string, stream: NodeJS.WriteStream): string {
  return styleText(style, text, { stream })
}
