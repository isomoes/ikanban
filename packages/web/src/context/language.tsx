import * as i18n from "@solid-primitives/i18n";
import { createEffect, createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import { createSimpleContext } from "ikanban-ui/context";
import { Persist, persisted } from "@/utils/persist";
import { dict as en } from "@/i18n/en";
import { dict as zh } from "@/i18n/zh";
import { dict as uiEn } from "ikanban-ui/i18n/en";
import { dict as uiZh } from "ikanban-ui/i18n/zh";

export type Locale = "en" | "zh";

type RawDictionary = typeof en & typeof uiEn;
type Dictionary = i18n.Flatten<RawDictionary>;

function cookie(locale: Locale) {
  return `oc_locale=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

const LOCALES: readonly Locale[] = ["en", "zh"];

const LABEL_KEY: Record<Locale, keyof Dictionary> = {
  en: "language.en",
  zh: "language.zh",
};

const base = i18n.flatten({ ...en, ...uiEn });
const DICT: Record<Locale, Dictionary> = {
  en: base,
  zh: { ...base, ...i18n.flatten({ ...zh, ...uiZh }) },
};

const localeMatchers: Array<{
  locale: Locale;
  match: (language: string) => boolean;
}> = [{ locale: "zh", match: (language) => language.startsWith("zh") }];

type ParityKey =
  | "command.session.previous.unseen"
  | "command.session.next.unseen";
const PARITY_CHECK: Record<"zh", Record<ParityKey, string>> = {
  zh,
};
void PARITY_CHECK;

function detectLocale(): Locale {
  if (typeof navigator !== "object") return "en";

  const languages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const language of languages) {
    if (!language) continue;
    const normalized = language.toLowerCase();
    const match = localeMatchers.find((entry) => entry.match(normalized));
    if (match) return match.locale;
  }

  return "en";
}

function normalizeLocale(value: string): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : "en";
}

export const { use: useLanguage, provider: LanguageProvider } =
  createSimpleContext({
    name: "Language",
    init: () => {
      const [store, setStore, _, ready] = persisted(
        Persist.global("language", ["language.v1"]),
        createStore({
          locale: detectLocale() as Locale,
        }),
      );

      const locale = createMemo<Locale>(() => normalizeLocale(store.locale));

      const dict = createMemo<Dictionary>(() => DICT[locale()]);

      const t = i18n.translator(dict, i18n.resolveTemplate);

      const label = (value: Locale) => t(LABEL_KEY[value]);

      createEffect(() => {
        if (typeof document !== "object") return;
        document.documentElement.lang = locale();
        document.cookie = cookie(locale());
      });

      return {
        ready,
        locale,
        locales: LOCALES,
        label,
        t,
        setLocale(next: Locale) {
          setStore("locale", normalizeLocale(next));
        },
      };
    },
  });
