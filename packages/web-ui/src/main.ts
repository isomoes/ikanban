/**
 * Web application entry: thin bootstrap over the shell library. Everything —
 * module-table seeding, the boot page, and the UI-renderer handoff — lives
 * in @isomoes/dsh-ikanban/client/web; this file only remaps the fork graph and
 * finds the mount point.
 */
import { AppWebEntry } from '@isomoes/dsh-ikanban/client/web'
import { remapForkedClientInjects } from './client-id-aliases.ts'

const el = document.getElementById('root')
if (el === null) throw new Error('web app: missing #root')
remapForkedClientInjects((window as Window & { __DSH_BOOT__?: unknown }).__DSH_BOOT__)
void new AppWebEntry(el).run()
