import { defineTable, type ExtractSchema, v } from "@will-be-done/hyperdb";

export const spacesTableType = "space";

// NOTE: add "orderToken" support
export const spacesTable = defineTable("spaces", {
  id: v.string(),
  type: v.literal(spacesTableType),
  name: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
}).index("byIds", ["id"]);

export type Space = ExtractSchema<typeof spacesTable>;
