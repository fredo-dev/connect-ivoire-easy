// Shared helpers for the Wave-style phone + 4-digit code login.
export const normalizePhone = (raw: string) => "+225" + raw.replace(/\D/g, "").replace(/^225/, "").slice(-10);
export const isValidPhone = (p: string) => /^\+225\d{10}$/.test(p);
export const phoneEmail = (p: string) => `${p.replace(/\D/g, "")}@tel.cabine-online.app`;
export const pinPassword = (p: string, pin: string) => `cab-${pin}-${p.replace(/\D/g, "")}`;
