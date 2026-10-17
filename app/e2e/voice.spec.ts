import { createProject } from "./support/app"
import { expect, test } from "./support/fixtures"

// The voice card's fallback, with no LiveKit at all: the browser refuses the microphone, so the
// card must say so and offer the typed message, without starting a session.
test("voice: a blocked microphone gets a clear message and a typed fallback", async ({
  page,
  owner,
}) => {
  await createProject(page, `Voice (${owner.suffix})`)

  const card = page.getByLabel("Voice assistant")

  await expect(card.getByRole("button", { name: "Start talking" })).toBeVisible()
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Permission denied", "NotAllowedError"))
  })
  await card.getByRole("button", { name: "Start talking" }).click()

  await expect(card.getByText("The microphone is blocked.")).toBeVisible()
  await expect(card.getByRole("button", { name: "Try again" })).toBeVisible()

  const form = card.getByRole("form", { name: "Type instead" })

  await form.getByLabel("Your message").fill("My microphone doesn't work today.")
  await form.getByRole("button", { name: "Send" }).click()
  await expect(form.getByText("Sent. It's saved with the project.")).toBeVisible()
})
