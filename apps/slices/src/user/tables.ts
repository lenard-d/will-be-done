import { defineTable, type ExtractSchema, v } from "@will-be-done/hyperdb-lib";

export const spacesTableType = "space";

export const spacesTable = defineTable("spaces", {
  id: v.string(),
  type: v.literal(spacesTableType),
  name: v.string(),
  createdAt: v.string(),
  updatedAt: v.string(),
}).index("byIds", ["id"]);

export type Space = ExtractSchema<typeof spacesTable>;
