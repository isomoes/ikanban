import type { FormField, FormInfo } from "@opencode/client"
import { For, Match, Show, Switch } from "solid-js"

export type FormAnswer = Record<string, string | number | boolean | string[]>
export function fieldVisible(field: FormField, answer: FormAnswer): boolean {
  if ("hidden" in field && field.hidden) return false
  return (
    !("when" in field) ||
    (field.when ?? []).every((condition) =>
      condition.op === "eq" ? answer[condition.key] === condition.value : answer[condition.key] !== condition.value,
    )
  )
}
export function formDefaults(fields: FormInfo["fields"]): FormAnswer {
  return Object.fromEntries(
    fields.flatMap((field) => ("default" in field && field.default !== undefined ? [[field.key, field.default]] : [])),
  )
}
export function visibleAnswer(fields: FormInfo["fields"], answer: FormAnswer): FormAnswer {
  return Object.fromEntries(
    fields
      .filter((field) => field.type !== "external" && fieldVisible(field, answer) && answer[field.key] !== undefined)
      .map((field) => [field.key, answer[field.key]]),
  )
}

/** Native V2 forms are also used by integration authentication. Keep field values, not labels. */
export function FormFields(props: {
  fields: FormInfo["fields"]
  answer: FormAnswer
  set: (key: string, value: FormAnswer[string]) => void
  disabled?: boolean
}) {
  const inputClass = "w-full rounded-md border border-border-base bg-input-base px-3 py-2 text-text-base"
  return (
    <div class="flex flex-col gap-4">
      <For each={props.fields}>
        {(field) => (
          <Show when={fieldVisible(field, props.answer)}>
            <fieldset disabled={props.disabled} class="flex flex-col gap-2 min-w-0">
              <legend class="text-14-medium text-text-strong">{field.title ?? field.key}</legend>
              <Show when={field.description}>
                <p class="text-12-regular text-text-weak">{field.description}</p>
              </Show>
              <Switch>
                <Match when={field.type === "external" && field}>
                  {(value) => (
                    <a href={value().url} target="_blank" rel="noopener noreferrer" class="underline break-all">
                      {value().url}
                    </a>
                  )}
                </Match>
                <Match when={field.type === "boolean" && field}>
                  {(value) => (
                    <select
                      class={inputClass}
                      aria-label={field.title ?? field.key}
                      required={value().required}
                      value={props.answer[field.key] === undefined ? "" : String(props.answer[field.key])}
                      onChange={(event) => props.set(field.key, event.currentTarget.value === "true")}
                    >
                      <option value="" disabled>
                        —
                      </option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  )}
                </Match>
                <Match when={(field.type === "number" || field.type === "integer") && field}>
                  {(value) => (
                    <input
                      class={inputClass}
                      aria-label={field.title ?? field.key}
                      type="number"
                      required={value().required}
                      step={value().type === "integer" ? 1 : "any"}
                      min={value().minimum}
                      max={value().maximum}
                      value={String(props.answer[field.key] ?? "")}
                      onInput={(event) =>
                        props.set(field.key, event.currentTarget.value === "" ? "" : event.currentTarget.valueAsNumber)
                      }
                    />
                  )}
                </Match>
                <Match when={field.type === "string" && field}>
                  {(value) => (
                    <>
                      <Show
                        when={value().options?.length && value().custom === false}
                        fallback={
                          <input
                            class={inputClass}
                            aria-label={field.title ?? field.key}
                            type={
                              value().format === "email"
                                ? "email"
                                : value().format === "uri"
                                  ? "url"
                                  : value().format === "date"
                                    ? "date"
                                    : "text"
                            }
                            required={value().required}
                            minLength={value().minLength}
                            maxLength={value().maxLength}
                            pattern={value().pattern}
                            placeholder={value().placeholder}
                            value={String(props.answer[field.key] ?? "")}
                            list={`form-${field.key}`}
                            onInput={(event) => props.set(field.key, event.currentTarget.value)}
                          />
                        }
                      >
                        <select
                          class={inputClass}
                          aria-label={field.title ?? field.key}
                          required={value().required}
                          value={String(props.answer[field.key] ?? "")}
                          onChange={(event) => props.set(field.key, event.currentTarget.value)}
                        >
                          <option value="">—</option>
                          <For each={value().options}>
                            {(option) => <option value={option.value}>{option.label}</option>}
                          </For>
                        </select>
                      </Show>
                      <datalist id={`form-${field.key}`}>
                        <For each={value().options}>
                          {(option) => <option value={option.value}>{option.label}</option>}
                        </For>
                      </datalist>
                    </>
                  )}
                </Match>
                <Match when={field.type === "multiselect" && field}>
                  {(value) => {
                    const selected = () =>
                      Array.isArray(props.answer[field.key]) ? (props.answer[field.key] as string[]) : []
                    return (
                      <>
                        <For each={value().options}>
                          {(option) => (
                            <label class="flex gap-2 items-start">
                              <input
                                type="checkbox"
                                checked={selected().includes(option.value)}
                                onChange={(event) =>
                                  props.set(
                                    field.key,
                                    event.currentTarget.checked
                                      ? [...selected(), option.value]
                                      : selected().filter((item) => item !== option.value),
                                  )
                                }
                              />
                              <span>
                                {option.label}
                                <Show when={option.description}>
                                  <span class="block text-text-weak text-12-regular">{option.description}</span>
                                </Show>
                              </span>
                            </label>
                          )}
                        </For>
                        <Show when={value().custom}>
                          <input
                            class={inputClass}
                            aria-label={`${field.title ?? field.key} — custom`}
                            placeholder="Additional values, separated by commas"
                            value={selected()
                              .filter((item) => !value().options.some((option) => option.value === item))
                              .join(", ")}
                            onChange={(event) =>
                              props.set(field.key, [
                                ...selected().filter((item) => value().options.some((option) => option.value === item)),
                                ...event.currentTarget.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              ])
                            }
                          />
                        </Show>
                      </>
                    )
                  }}
                </Match>
              </Switch>
            </fieldset>
          </Show>
        )}
      </For>
    </div>
  )
}
