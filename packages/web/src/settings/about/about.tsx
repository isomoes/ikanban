import { useLanguage } from "@/runtime/i18n/language";
import { ExternalLink } from "@/runtime/platform/external-link";
import { KanbanMark } from "@/shell/titlebar/kanban-mark";
import {
  IKANBAN_ISSUES,
  IKANBAN_REPOSITORY,
  IKANBAN_WEBSITE,
} from "@/shell/links";
import { version } from "../../../package.json";

export function SettingsAbout(_props: { active: boolean }) {
  const language = useLanguage();
  const build = import.meta.env.DEV ? "dev" : version;

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
          <ExternalLink href={IKANBAN_WEBSITE}>
            isomoes.github.io/ikanban
          </ExternalLink>
        </p>
        <p>
          <ExternalLink href={IKANBAN_REPOSITORY}>
            {language.t("settings.about.ikanbanRepository")}
          </ExternalLink>
          {" · "}
          <ExternalLink href={IKANBAN_ISSUES}>
            {language.t("settings.about.ikanbanIssues")}
          </ExternalLink>
          {" · "}
          <ExternalLink href={`${IKANBAN_REPOSITORY}/releases`}>
            {language.t("settings.about.ikanbanReleases")}
          </ExternalLink>
        </p>
      </div>

      <div class="settings-about-credits">
        <p>
          {language.t("settings.about.writtenBy")}{" "}
          <ExternalLink href="https://github.com/isomoes">isomoes</ExternalLink>
          {" · "}
          <ExternalLink href={`${IKANBAN_REPOSITORY}/graphs/contributors`}>
            {language.t("settings.about.ikanbanContributors")}
          </ExternalLink>
        </p>
        <p>
          {language.t("settings.about.ikanbanUpstream")}{" "}
          <ExternalLink href="https://github.com/anomalyco/opencode">
            OpenCode
          </ExternalLink>
        </p>
      </div>

      <div class="settings-about-copyright">
        <p>
          <ExternalLink href={`${IKANBAN_REPOSITORY}/blob/main/LICENSE`}>
            {language.t("settings.about.license")}
          </ExternalLink>
        </p>
        <p>© 2026 isomoes</p>
      </div>
    </div>
  );
}
