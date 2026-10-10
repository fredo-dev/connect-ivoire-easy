import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_transactions",
  title: "Historique des paiements",
  description: "List the signed-in user's recent plan purchases and credit recharges with amounts, fees and status.",
  inputSchema: {
    status: z.enum(["pending", "success", "error"]).optional().describe("Status filter."),
    limit: z.number().int().min(1).max(100).default(20).describe("Maximum rows."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    let q = supabaseForUser(ctx)
      .from("transactions")
      .select("id,kind,label,operator,phone,amount,fee,total,payment_method,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw new ToolError("Impossible de charger l'historique");
    const transactions = data ?? [];
    return { content: [{ type: "text", text: JSON.stringify(transactions) }], structuredContent: { transactions } };
  },
});
