import type { useLanguage } from "@/runtime/i18n/language"

type Translate = ReturnType<typeof useLanguage>["t"]

export function methodLabel(value: { type?: string; label?: string } | undefined, t: Translate) {
  if (!value) return ""
  if (value.type === "key") return t("provider.connect.method.apiKey")
  return value.label ?? ""
}

export function methodDetails(value: { type?: string; label?: string } | undefined, t: Translate) {
  const label = methodLabel(value, t)
  const suffix = value?.label?.match(/\s+\((browser|headless)\)$/i)
  const hint = suffix?.[1]
  return {
    label: suffix ? label.slice(0, -suffix[0].length) : label,
    hint:
      hint?.toLowerCase() === "headless"
        ? t("provider.connect.method.headless")
        : hint?.toLowerCase() === "browser" || (!hint && value?.type === "key")
          ? t("provider.connect.method.browser")
          : undefined,
  }
}
