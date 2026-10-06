// Creates a pre-confirmed Identity user. Admin-only.
// Uses the short-lived admin token Netlify gives every function (context.clientContext.identity).
export const handler = async (event, context) => {
  const json = (s, o) => ({ statusCode: s, headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  const ident = context.clientContext && context.clientContext.identity;
  if (!ident || !ident.url || !ident.token) return json(500, { error: "No Identity admin access is available to this function." });

  // Ask our own API who is calling (it already handles login cookies and renewals).
  const host = event.headers["x-forwarded-host"] || event.headers.host;
  const chk = await fetch("https://" + host + "/api/me", { headers: { cookie: event.headers.cookie || "" } });
  const me = chk.ok ? await chk.json().catch(() => null) : null;
  if (!me) return json(401, { error: "Sign in required (login check returned " + chk.status + ")." });
  if (!me.admin) return json(403, { error: "Admins only." });

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
