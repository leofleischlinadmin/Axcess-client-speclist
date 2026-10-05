import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";

const J = (o, s = 200) => Response.json(o, { status: s });
const ID = /^[\w-]+$/;

export default async (req) => {
  const u = await getUser();
  if (!u) return J({ error: "Sign in required" }, 401);
  const admin = (u.roles || []).includes("admin");
  const meta = getStore("meta"), states = getStore("state"), photos = getStore("photos");
  const [, , kind, pid, pho] = new URL(req.url).pathname.split("/");
  if ((pid && !ID.test(pid)) || (pho && !ID.test(pho))) return J({ error: "Bad id" }, 400);
  const can = (m) => m && (m.owner === u.id || admin);

  // list / create projects
  if (kind === "projects" && !pid) {
    if (req.method === "POST") {
      const { name } = await req.json();
      const id = crypto.randomUUID().slice(0, 8);
      const m = { id, name: String(name || "Project").slice(0, 80), owner: u.id, ownerEmail: u.email, n: 0, updated: Date.now() };
      await meta.setJSON("p/" + id, m);
      await states.setJSON(id, { rooms: [], d: {}, ph: {} });
      return J(m);
    }
    const { blobs } = await meta.list({ prefix: "p/" });
    const all = (await Promise.all(blobs.map((b) => meta.get(b.key, { type: "json" })))).filter(can);
    return J(all.sort((a, b) => b.updated - a.updated));
  }

  // everything below needs access to one project
  const m = pid ? await meta.get("p/" + pid, { type: "json" }) : null;
  if (!can(m)) return J({ error: "Not found" }, 404);

  if (kind === "projects") {
    if (req.method === "PUT") {
      const { state, n } = await req.json();
      await states.setJSON(pid, state);
      await meta.setJSON("p/" + pid, { ...m, n, updated: Date.now() });
      return J({ ok: true });
    }
    return J((await states.get(pid, { type: "json" })) || {});
  }

  if (kind === "photo" && pho) {
    const key = pid + "/" + pho;
    if (req.method === "POST") { await photos.set(key, await req.arrayBuffer()); return J({ ok: true }); }
    if (req.method === "DELETE") { await photos.delete(key); return J({ ok: true }); }
    const buf = await photos.get(key, { type: "arrayBuffer" });
    return buf
      ? new Response(buf, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400" } })
      : J({ error: "Not found" }, 404);
  }
  return J({ error: "Not found" }, 404);
};

export const config = { path: "/api/*" };
