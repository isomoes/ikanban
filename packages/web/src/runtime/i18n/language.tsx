import { flatten, resolveTemplate, translator, type Flatten } from "@solid-primitives/i18n"
import { createEffect, createMemo, createResource, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Option, Schema, SchemaGetter } from "effect"
import { createSimpleContext } from "@opencode/ui/context"
import {
  I18nProvider,
  type UiI18n,
  pluralCategory,
  type UiI18nPluralLookupKey,
  type UiI18nPluralKey,
  type UiPluralCategory,
} from "@opencode/ui/context/i18n"
import { Persist, persisted } from "@/runtime/persistence/storage"
import { Persistence } from "@/runtime/persistence/schema"
import en from "@/runtime/i18n/en"
import { dict } from "@opencode/ui/i18n/en"
import {
  createDesktopNativeBundle,
  detectDesktopNativeLocale,
  DESKTOP_NATIVE_ENGLISH,
  DESKTOP_NATIVE_LABELS,
  DESKTOP_NATIVE_LOCALES,
  DESKTOP_NATIVE_LOCALE_TAGS,
  type DesktopNativeBundle,
  type DesktopNativeLocale,
} from "@/runtime/i18n/desktop-native"

export type Locale = DesktopNativeLocale
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

const LOCALES: readonly Locale[] = DESKTOP_NATIVE_LOCALES

const LocaleSchema = Schema.Literals(DESKTOP_NATIVE_LOCALES)
const StoredLocaleSchema = Schema.Struct({
  locale: Schema.String.pipe(
    Schema.decodeTo(LocaleSchema, {
      decode: SchemaGetter.transform(normalizeLocale),
      encode: SchemaGetter.transform((locale) => locale),
    }),
  ),
})

const INTL = DESKTOP_NATIVE_LOCALE_TAGS

const base = flatten({ ...en, ...dict })
const dicts = new Map<Locale, Dictionary>([["en", base]])

const merge = (app: Promise<Source>, ui: Promise<Source>) =>
  Promise.all([app, ui]).then(([a, b]) => ({ ...base, ...flatten({ ...a.dict, ...b.dict }) }) as Dictionary)

const loaders: Record<Exclude<Locale, "en">, () => Promise<Dictionary>> = {
  zh: () => merge(import("@/runtime/i18n/zh"), import("@opencode/ui/i18n/zh")),
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

function detectLocale(): Locale {
  if (typeof navigator !== "object") return "en"
  return detectDesktopNativeLocale(navigator.languages?.length ? navigator.languages : [navigator.language])
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
  init: (props: { locale?: Locale; onNativeTranslations?: (bundle: DesktopNativeBundle) => void }) => {
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

    const label = (value: Locale) => DESKTOP_NATIVE_LABELS[value]

    createEffect(() => {
      if (typeof document !== "object") return
      const value = locale()
      document.documentElement.lang = intl()
      document.documentElement.dir = direction()
      document.cookie = cookie(value)
    })

    createEffect(() => {
      if (!props.onNativeTranslations || dictionary.loading) return
      const current = dictionary()
      if (!current) return
      props.onNativeTranslations(
        createDesktopNativeBundle(locale(), (key) => current[key] ?? DESKTOP_NATIVE_ENGLISH[key]),
      )
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
