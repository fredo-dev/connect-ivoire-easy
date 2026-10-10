import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_plans",
  title: "Lister les forfaits",
  description: "List available internet, call and mixed plans, optionally filtered by operator and type.",
  inputSchema: {
    operator: z.enum(["orange", "mtn", "moov", "wave"]).optional().describe("Operator filter."),
    kind: z.enum(["internet", "appels", "mixte"]).optional().describe("Plan type filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ operator, kind }, ctx) => {
    let q = supabaseForUser(ctx).from("plans").select("id,operator,kind,name,description,validity,price").order("price");
    if (operator) q = q.eq("operator", operator);
    if (kind) q = q.eq("kind", kind);
    const { data, error } = await q;
    if (error) throw new ToolError("Impossible de charger les forfaits");
    const plans = (data ?? []).map((p) => ({ ...p, price_xof: p.price }));
    return { content: [{ type: "text", text: JSON.stringify(plans) }], structuredContent: { plans } };
  },
});
