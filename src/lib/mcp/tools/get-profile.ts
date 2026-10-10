import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_profile",
  title: "Voir mon profil",
  description: "Return the signed-in user's name, phone number and operator.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const { data, error } = await supabaseForUser(ctx)
      .from("profiles").select("full_name,phone,operator").eq("id", ctx.getUserId()!).maybeSingle();
    if (error) throw new ToolError("Impossible de charger le profil");
    const profile = { full_name: data?.full_name ?? null, phone: data?.phone ?? null, operator: data?.operator ?? null, email: ctx.getUserEmail() ?? null };
    return { content: [{ type: "text", text: JSON.stringify(profile) }], structuredContent: { profile } };
  },
});
