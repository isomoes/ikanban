import { useLanguage } from "@/runtime/i18n/language"
import { ExternalLink } from "@/runtime/platform/external-link"
import { KanbanMark } from "@/shell/titlebar/kanban-mark"
import { version } from "../../../package.json"

const repository = "https://github.com/isomoes/ikanban"

export function SettingsAbout(_props: { active: boolean }) {
  const language = useLanguage()
  const build = import.meta.env.DEV ? "dev" : version

  return (
    <div class="settings-about-content">
      <div class="flex items-center gap-3 text-v2-text-text-base">
        <KanbanMark class="size-12" />
        <h2 class="text-3xl font-semibold">iKanban</h2>
      </div>

      <div class="settings-about-intro">
        <p>{language.t("settings.about.version", { version: build })}</p>
        <p>{language.t("settings.about.ikanbanDescription")}</p>
      </div>

      <div class="settings-about-details">
        <p>
          <ExternalLink href="https://isomoes.github.io/ikanban/">isomoes.github.io/ikanban</ExternalLink>
        </p>
        <p>
          <ExternalLink href={repository}>{language.t("settings.about.ikanbanRepository")}</ExternalLink>
          {" · "}
          <ExternalLink href={`${repository}/issues`}>{language.t("settings.about.ikanbanIssues")}</ExternalLink>
          {" · "}
          <ExternalLink href={`${repository}/releases`}>{language.t("settings.about.ikanbanReleases")}</ExternalLink>
        </p>
      </div>

      <div class="settings-about-credits">
        <p>
          {language.t("settings.about.writtenBy")} <ExternalLink href="https://github.com/isomoes">isomoes</ExternalLink>
          {" · "}
          <ExternalLink href={`${repository}/graphs/contributors`}>
            {language.t("settings.about.ikanbanContributors")}
          </ExternalLink>
        </p>
        <p>
          {language.t("settings.about.ikanbanUpstream")}{" "}
          <ExternalLink href="https://github.com/anomalyco/opencode">OpenCode</ExternalLink>
        </p>
      </div>

      <div class="settings-about-copyright">
        <p>
          <ExternalLink href={`${repository}/blob/main/LICENSE`}>{language.t("settings.about.license")}</ExternalLink>
        </p>
        <p>© 2026 isomoes</p>
      </div>
    </div>
  )
}
