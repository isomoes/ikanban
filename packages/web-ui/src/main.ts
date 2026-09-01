/**
 * Web application entry over the locally owned flattened shell library.
 * Host-injected client package ids are remapped before boot so shared UI
 * dependencies resolve to this neutral fork.
 */
import { AppWebEntry } from '@isomoes/dsh-web-ui/client/web'
import { remapForkedClientInjects } from './client-id-aliases.ts'

const el = document.getElementById('root')
if (el === null) throw new Error('web app: missing #root')
remapForkedClientInjects((window as Window & { __DSH_BOOT__?: unknown }).__DSH_BOOT__)
void new AppWebEntry(el).run()
