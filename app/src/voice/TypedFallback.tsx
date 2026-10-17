import { useState, type SubmitEvent } from "react"
import { useErrorState } from "../lib/errors"
import { Button, ButtonVariant, Field, Text, TextArea, TextSize, TextTone } from "../ui"

export interface TypedFallbackProps {
  onSend: (text: string) => Promise<void>
}

// When voice doesn't work, the user can still say what she meant to: the message is saved
// (voice.saveTypedMessage on the example page), so the page is never a dead end.
export function TypedFallback({ onSend }: TypedFallbackProps) {
  const [draft, setDraft] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const { error, setError, showError } = useErrorState()

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setIsSending(true)

    try {
      await onSend(draft)
      setDraft("")
      setIsSent(true)
    } catch (caught) {
      showError(caught)
    } finally {
      setIsSending(false)
    }
  }

  return (
    <form
      className="voice-typed"
      aria-label="Type instead"
      onSubmit={(event) => void submit(event)}
    >
      <Field label="Your message">
        <TextArea
          value={draft}
          required
          onChange={(event) => {
            setDraft(event.target.value)
            setIsSent(false)
          }}
        />
      </Field>
      <div>
        <Button type="submit" variant={ButtonVariant.Primary} disabled={isSending}>
          Send
        </Button>
      </div>
      {isSent ? (
        <Text tone={TextTone.Accent} size={TextSize.Small}>
          Sent. It's saved with the project.
        </Text>
      ) : null}
      {error ? (
        <Text tone={TextTone.Danger} alert>
          {error}
        </Text>
      ) : null}
    </form>
  )
}
