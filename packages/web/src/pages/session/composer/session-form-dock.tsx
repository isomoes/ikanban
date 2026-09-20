import type { FormInfo } from "@opencode/client"
import { createStore } from "solid-js/store"
import { Button } from "@/ui/components/button"
import { DockPrompt } from "@/ui/components/dock-prompt"
import { FormFields, formDefaults, visibleAnswer } from "@/components/form-fields"
import { useSDK } from "@/context/sdk"
import { useLanguage } from "@/context/language"
import { showToast } from "@/ui/components/toast"

export function SessionFormDock(props: { form: FormInfo; onSubmit: () => void }) {
  const sdk = useSDK()
  const language = useLanguage()
  const [state, setState] = createStore({ answer: formDefaults(props.form.fields), sending: false })
  const send = async (cancel = false) => {
    if (state.sending) return
    setState("sending", true)
    const input = { sessionID: props.form.sessionID, formID: props.form.id }
    try {
      if (cancel) await sdk.client.native.session.form.cancel(input)
      else
        await sdk.client.native.session.form.reply({ ...input, answer: visibleAnswer(props.form.fields, state.answer) })
      props.onSubmit()
    } catch (error) {
      showToast({
        title: language.t("common.requestFailed"),
        description: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setState("sending", false)
    }
  }
  const formID = `request-${props.form.id}`
  return (
    <DockPrompt
      kind="question"
      header={<div data-slot="question-header-title">{props.form.title}</div>}
      footer={
        <>
          <Button variant="ghost" size="large" disabled={state.sending} onClick={() => void send(true)}>
            {language.t("ui.common.dismiss")}
          </Button>
          <Button variant="primary" size="large" type="submit" form={formID} disabled={state.sending}>
            {language.t("ui.common.submit")}
          </Button>
        </>
      }
    >
      <form
        id={formID}
        onSubmit={(event) => {
          event.preventDefault()
          void send()
        }}
      >
        <FormFields
          fields={props.form.fields}
          answer={state.answer}
          disabled={state.sending}
          set={(key, value) => setState("answer", key, value)}
        />
      </form>
    </DockPrompt>
  )
}
