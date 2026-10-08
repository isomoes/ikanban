import { flatten, resolveTemplate, translator, type Flatten } from "@solid-primitives/i18n"
import { createEffect, createMemo, createResource, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Option, Schema, SchemaGetter } from "effect"
import { createSimpleContext } from "@ikanban/ui/context"
import {
  I18nProvider,
  type UiI18n,
  pluralCategory,
  type UiI18nPluralLookupKey,
  type UiI18nPluralKey,
  type UiPluralCategory,
} from "@ikanban/ui/context/i18n"
import { Persist, persisted } from "@/runtime/persistence/storage"
import { Persistence } from "@/runtime/persistence/schema"
import en from "@/runtime/i18n/en"
import { dict } from "@ikanban/ui/i18n/en"

const LOCALES = ["en", "zh"] as const

export type Locale = (typeof LOCALES)[number]
export type Direction = "ltr" | "rtl"

function localeDirection(_locale: Locale): Direction {
  return "ltr"
}

type RawDictionary = typeof en & typeof dict
type Dictionary = Flatten<RawDictionary>
type AppI18nKey = Extract<keyof typeof en, string>
type AppI18nPluralKey = {
  [Key in AppI18nKey]: Key extends `${infer Base}.other` ? (`${Base}.one` extends AppI18nKey ? Base : never) : never
}[AppI18nKey]
type PluralKey = AppI18nPluralKey | UiI18nPluralKey
type AppI18nPluralLookupKey = `${AppI18nPluralKey}.${UiPluralCategory}`
type TranslationKey<Key extends Extract<keyof Dictionary, string>> = Key extends
  | AppI18nPluralLookupKey
  | UiI18nPluralLookupKey
  ? never
  : Key
type Source = { dict: Record<string, string> }

function cookie(locale: Locale) {
  return `ikanban.v2.locale=${encodeURIComponent(locale)}; Path=/ikanban/; Max-Age=31536000; SameSite=Lax`
}

const LocaleSchema = Schema.Literals(LOCALES)
const StoredLocaleSchema = Schema.Struct({
  locale: Schema.String.pipe(
    Schema.decodeTo(LocaleSchema, {
      decode: SchemaGetter.transform(normalizeLocale),
      encode: SchemaGetter.transform((locale) => locale),
    }),
  ),
})

const LABELS: Record<Locale, string> = {
  en: "English",
  zh: "简体中文",
}

const INTL: Record<Locale, string> = {
  en: "en",
  zh: "zh-Hans",
}

const base = flatten({ ...en, ...dict })
const dicts = new Map<Locale, Dictionary>([["en", base]])

const merge = (app: Promise<Source>, ui: Promise<Source>) =>
  Promise.all([app, ui]).then(([a, b]) => ({ ...base, ...flatten({ ...a.dict, ...b.dict }) }) as Dictionary)

const loaders: Record<Exclude<Locale, "en">, () => Promise<Dictionary>> = {
  zh: () => merge(import("@/runtime/i18n/zh"), import("@ikanban/ui/i18n/zh")),
}

function loadDict(locale: Locale) {
  const hit = dicts.get(locale)
  if (hit) return Promise.resolve(hit)
  if (locale === "en") return Promise.resolve(base)
  const load = loaders[locale]
  return load().then((next: Dictionary) => {
    dicts.set(locale, next)
    return next
  })
}

export function loadLocaleDict(locale: Locale) {
  return loadDict(locale).then(() => undefined)
}

function parseLocale(value: string) {
  try {
    return new Intl.Locale(value).maximize()
  } catch {
    return undefined
  }
}

function detectLocale(): Locale {
  if (typeof navigator !== "object") return "en"
  for (const language of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const source = parseLocale(language)
    if (!source) continue
    const match = LOCALES.find((candidate) => parseLocale(INTL[candidate])?.language === source.language)
    if (match) return match
  }
  return "en"
}

export function normalizeLocale(value: string): Locale {
  return Option.getOrElse(Schema.decodeUnknownOption(LocaleSchema)(value), () => "en")
}

export const languageSchema = Persistence.struct({
  locale: StoredLocaleSchema.fields.locale,
})

const languageTarget = Persist.global("language")

export function readStoredLocale() {
  if (typeof localStorage !== "object") return
  try {
    const raw = localStorage.getItem(`${languageTarget.storage}:${languageTarget.key}`)
    if (!raw) return
    const next = Schema.decodeUnknownOption(Schema.fromJsonString(StoredLocaleSchema))(raw)
    if (Option.isNone(next)) return
    return next.value.locale
  } catch {
    return
  }
}

const warm = readStoredLocale() ?? detectLocale()
const initialLocale =
  warm === "en"
    ? Promise.resolve(warm)
    : loadDict(warm).then(
        () => warm,
        () => "en" as const,
      )

export function loadInitialLocale() {
  return initialLocale
}

export const { use: useLanguage, provider: LanguageProvider } = createSimpleContext({
  name: "Language",
  gate: false,
  init: (props: { locale?: Locale }) => {
    const initial = props.locale ?? readStoredLocale() ?? detectLocale()
    const [store, setStore, _, ready] = persisted(languageTarget, languageSchema, { locale: initial })

    const locale = createMemo(() => store.locale)
    const intl = createMemo(() => INTL[locale()])
    const [layout, setLayout] = createStore({ direction: undefined as Direction | undefined })
    const direction = createMemo(() => layout.direction ?? localeDirection(locale()))
    const layoutLocale = createMemo(() => {
      if (!layout.direction) return intl()
      // Kobalte derives menu direction from locale rather than accepting a direction override.
      return layout.direction === "rtl" ? "ar" : "en"
    })

    const [dictionary] = createResource(locale, loadDict, {
      initialValue: dicts.get(initial) ?? base,
    })

    const t = translator(() => dictionary() ?? base, resolveTemplate) as <
      Key extends Extract<keyof Dictionary, string>,
    >(
      key: TranslationKey<Key>,
      params?: Record<string, string | number | boolean>,
    ) => string

    const rich = (key: Parameters<typeof t>[0], params: Record<string, JSX.Element>) =>
      t(key)
        .split(/(\{\{\w+\}\})/g)
        .map((part, index) => (index % 2 ? (params[part.slice(2, -2)] ?? part) : part))

    const pluralForm = (
      key: PluralKey,
      category: UiPluralCategory,
      params?: Record<string, string | number | boolean>,
    ) => {
      const current = (dictionary.loading ? base : (dictionary() ?? base)) as Record<string, string>
      const candidate = `${key}.${category}`
      const fallback = `${key}.other`
      return resolveTemplate(current[candidate] ?? current[fallback] ?? fallback, params)
    }
    const plural = (key: PluralKey, count: number, params?: Record<string, string | number | boolean>) =>
      pluralForm(key, pluralCategory(intl(), count), { ...params, count })

    const label = (value: Locale) => LABELS[value]

    createEffect(() => {
      if (typeof document !== "object") return
      const value = locale()
      document.documentElement.lang = intl()
      document.documentElement.dir = direction()
      document.cookie = cookie(value)
    })

    return {
      ready,
      locale,
      intl,
      direction,
      layoutLocale,
      locales: LOCALES,
      label,
      t,
      rich,
      plural,
      pluralForm,
      setLocale(next: Locale) {
        setStore("locale", normalizeLocale(next))
      },
      setDirection(next: Direction) {
        setLayout("direction", next === localeDirection(locale()) ? undefined : next)
      },
    }
  },
})

export function UiI18nBridge(props: { children?: JSX.Element }) {
  const language = useLanguage()
  return (
    <I18nProvider
      value={{
        locale: language.intl,
        layoutLocale: language.layoutLocale,
        t: language.t as UiI18n["t"],
        plural: language.plural,
        pluralForm: language.pluralForm,
      }}
    >
      {props.children}
    </I18nProvider>
  )
}
