/**
 * Web application entry: thin bootstrap over the shell library. Everything —
 * loader holding, module-table seeding, AppRoot gate, plugin assembly — lives
 * in @deepseek-ai/dsh-client-web; this file only finds the mount point.
 */
import { AppWebEntry } from '@deepseek-ai/dsh-client-web'
import { remapForkedClientInjects } from './client-id-aliases.ts'

const el = document.getElementById('root')
if (el === null) throw new Error('web app: missing #root')
remapForkedClientInjects((window as Window & { __DSH_BOOT__?: unknown }).__DSH_BOOT__)
void new AppWebEntry(el).run()
