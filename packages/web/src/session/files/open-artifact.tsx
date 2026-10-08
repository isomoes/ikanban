import type { ParentProps } from "solid-js"
import { createSimpleContext } from "@ikanban/ui/context"
import { MarkdownProvider, useMarkdown } from "@ikanban/session-ui/context/markdown"
import { useFile } from "@/workspaces/files/model"
import { resolveArtifactPath } from "@/workspaces/files/artifact"
import { useWorkspaceLocation } from "@/workspaces/location"
import { useSessionLayout } from "@/session/session-layout"
import { createOpenSessionFileTab } from "@/session/helpers"

/** Routes local links in timeline markdown to the artifact opener while keeping image loading. */
export function ArtifactMarkdownProvider(props: ParentProps) {
  const markdown = useMarkdown()
  const artifacts = useArtifactOpener()
  return (
    <MarkdownProvider readImage={markdown?.readImage} openLocalFile={(path) => artifacts.open(path)}>
      {props.children}
    </MarkdownProvider>
  )
}

/**
 * Opens files the agent references as side-panel tabs, inside or outside the workspace.
 */
export const { use: useArtifactOpener, provider: ArtifactOpenerProvider } = createSimpleContext({
  name: "ArtifactOpener",
  init: () => {
    const file = useFile()
    const location = useWorkspaceLocation()
    const { tabs, view } = useSessionLayout()

    const root = () => location().directory.replaceAll("\\", "/").replace(/\/+$/, "")

    /**
     * Turn a link into a path `useFile` can load: workspace-relative when it is under the root,
     * otherwise absolute. Relative links resolve against `base`; ones that climb past the root
     * become absolute too, so a `../../shared/report.pdf` still opens.
     */
    const resolve = (href: string, base?: string) => {
      // Agents cite locations as path:line or path:line:col; the file is what opens.
      const value = href.replaceAll("\\", "/").replace(/:\d+(?::\d+)?$/, "")
      if (/^[a-z]:\//i.test(value) || value.startsWith("/")) return file.normalize(value)
      const relative = resolveArtifactPath(base ?? "", value)
      if (relative !== undefined) return file.normalize(relative)
      // Climbing past the workspace root: resolve from the referencing folder's absolute location.
      const dir = base ? `${root()}/${base.replace(/\/+$/, "")}` : root()
      return file.normalize(resolveArtifactPath(dir, value) ?? value)
    }

    const showTab = createOpenSessionFileTab({
      normalizeTab: (tab) => tab,
      openTab: (tab) => tabs().open(tab),
      pathFromTab: file.pathFromTab,
      loadFile: () => undefined,
      openReviewPanel: () => {
        if (!view().reviewPanel.opened()) view().reviewPanel.open()
      },
      setActive: (tab) => tabs().setActive(tab),
    })

    // Inline paths are guessed from text, so confirm the file exists before a tab appears for it.
    const openTab = (path: string) => {
      void file.load(path).then(() => {
        if (file.get(path)?.loaded) showTab(file.tab(path))
      })
    }

    /** Open `href` as referenced from `base` (a workspace-relative directory, "" for the root). */
    const open = (href: string, base?: string) => {
      const path = resolve(href, base)
      if (!path) return
      openTab(path)
    }

    return { open }
  },
})
