import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPlans from "./tools/list-plans";
import getProfile from "./tools/get-profile";
import listTransactions from "./tools/list-transactions";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "cabine-connect",
  title: "Cabine Connect",
  version: "0.1.0",
  instructions:
    "Cabine Online (Côte d'Ivoire): browse phone plans (Orange, MTN, Moov, Wave), read the user's profile and payment history. Amounts are in XOF; a 1.5% service fee applies to every payment. Payments themselves are made in the app.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listPlans, getProfile, listTransactions],
});
