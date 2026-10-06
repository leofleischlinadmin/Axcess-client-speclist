// Creates a pre-confirmed Identity user. Admin-only.
// Uses the short-lived admin token Netlify gives every function (context.clientContext.identity).
export const handler = async (event, context) => {
  const json = (s, o) => ({ statusCode: s, headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });

  const ident = context.clientContext && context.clientContext.identity;
  if (!ident || !ident.url || !ident.token) return json(500, { error: "No Identity admin access is available to this function." });

  // Check who is calling: try the login cookie(s) against Identity.
  const jar = {};
  (event.headers.cookie || "").split(/;\s*/).forEach((c) => { const i = c.indexOf("="); if (i > 0) jar[c.slice(0, i)] = c.slice(i + 1); });
  const jwtLike = (v) => /^[\w-]+\.[\w-]+\.[\w-]+$/.test(v);
  const names = Object.keys(jar).filter((k) => k === "nf_jwt" || jwtLike(decodeURIComponent(jar[k])));
  let caller = null;
  const tried = [];
  for (const k of names) {
    const r0 = await fetch(ident.url + "/user", { headers: { Authorization: "Bearer " + decodeURIComponent(jar[k]) } });
    tried.push(k + ":" + r0.status);
    if (r0.ok) { caller = await r0.json(); break; }
  }
  if (!caller) return json(401, { error: "Sign in required. Cookies seen: " + (Object.keys(jar).join(", ") || "none") + ". Checked: " + (tried.join(", ") || "none") });
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
