import { authTables } from "@convex-dev/auth/server"
import { defineSchema, defineTable } from "convex/server"
import { feedbackFields } from "./lib/feedback"
import { projectFields } from "./lib/validators"

export default defineSchema({
  ...authTables,

  projects: defineTable(projectFields)
    .index("by_owner", ["ownerId"])
    .index("by_shareToken", ["shareToken"]),

  feedback: defineTable(feedbackFields)
    .index("by_createdAt", ["createdAt"])
    .index("by_status", ["status", "createdAt"])
    .index("by_owner", ["ownerId"]),
})
