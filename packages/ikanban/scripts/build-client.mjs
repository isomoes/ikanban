import { readFile, writeFile } from 'node:fs/promises'

const sources = await Promise.all([
  readFile(new URL('../../ui-layout/src/client.js', import.meta.url), 'utf8'),
  readFile(new URL('../../ui-sidebar/src/client.js', import.meta.url), 'utf8'),
  readFile(new URL('../../ui-workspace/src/client.js', import.meta.url), 'utf8'),
])
const sourceIds = [
  '@isomoes/dsh-ikanban-ui-layout',
  '@isomoes/dsh-ikanban-ui-sidebar',
  '@isomoes/dsh-ikanban-ui-workspace',
]
const clientId = '@isomoes/dsh-ikanban'

const factories = sources.map((source, index) => {
  const startMarker = '\tfactory: '
  const endMarker = '\n});'
  const start = source.indexOf(startMarker)
  const end = source.lastIndexOf(endMarker)
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`invalid vendored client wrapper: ${sourceIds[index]}`)
  }
  return source
    .slice(start + startMarker.length, end)
    .replaceAll(sourceIds[index], clientId)
})

const aggregate = `window.__ModuleLoader__.load({
\tid: "${clientId}",
\tfactory: (require) => {
\t\tconst layout = (${factories[0]})(require);
\t\tconst sidebar = (${factories[1]})(require);
\t\tconst workspace = (${factories[2]})(require);
\t\tconst inject = ["slots", "theme", "locale", "sessions", "workspaces"];
\t\tfunction apply(ctx) {
\t\t\tlayout.apply(ctx);
\t\t\tsidebar.apply(ctx);
\t\t\tworkspace.apply(ctx);
\t\t\tctx.effect(() => {
\t\t\t\tconst source = new EventSource("/plugins/events");
\t\t\t\tconst onMessage = (event) => {
\t\t\t\t\ttry {
\t\t\t\t\t\tconst frame = JSON.parse(event.data);
\t\t\t\t\t\tif (frame.type === "rebuilt" && frame.id === "${clientId}") window.location.reload();
\t\t\t\t\t} catch {}
\t\t\t\t};
\t\t\t\tsource.addEventListener("message", onMessage);
\t\t\t\treturn () => source.close();
\t\t\t}, "ikanban: live reload");
\t\t}
\t\treturn { apply, inject };
\t}
});
`

await Promise.all([
  writeFile(new URL('../lib/client.js', import.meta.url), aggregate),
  writeFile(
    new URL('../lib/types/client.d.ts', import.meta.url),
    'export declare const inject: string[]\nexport declare function apply(ctx: unknown): void\n',
  ),
])
