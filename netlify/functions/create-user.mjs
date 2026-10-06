// Creates a pre-confirmed Identity user. Admin-only.
// Uses the short-lived admin token Netlify gives every function (context.clientContext.identity).
export const handler = async (event, context) => {
  const json = (s, o) => ({ statusCode: s, headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  const ident = context.clientContext && context.clientContext.identity;
  if (!ident || !ident.url || !ident.token) return json(500, { error: "No Identity admin access is available to this function." });

  // Check who is calling: read their login cookie and ask Identity who they are.
  const m = /(?:^|;\s*)nf_jwt=([^;]+)/.exec(event.headers.cookie || "");
  if (!m) return json(401, { error: "Sign in required." });
  const me = await fetch(ident.url + "/user", { headers: { Authorization: "Bearer " + decodeURIComponent(m[1]) } });
  if (!me.ok) return json(401, { error: "Sign in required." });
  const caller = await me.json();
  const roles = (caller.app_metadata && caller.app_metadata.roles) || [];
  if (!roles.includes("admin")) return json(403, { error: "Admins only." });

  const { email, password } = JSON.parse(event.body || "{}");
  if (!email || !password || password.length < 8) return json(400, { error: "Enter an email and a password of at least 8 characters." });

  const tok = typeof ident.token === "string" ? ident.token : ident.token.access_token;
  const r = await fetch(ident.url + "/admin/users", {
    method: "POST",
    headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, confirm: true }),
  });
  if (!r.ok) return json(400, { error: "Identity returned " + r.status + ": " + (await r.text()).slice(0, 200) });
  return json(200, { ok: true });
};
