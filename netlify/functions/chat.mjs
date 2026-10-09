import Anthropic from "@anthropic-ai/sdk";
import { getStore } from "@netlify/blobs";
import { getUser } from "@netlify/identity";

const anthropic = new Anthropic(); // key comes from Netlify AI Gateway, or ANTHROPIC_API_KEY if you set one
const J = (o, s = 200) => Response.json(o, { status: s });
const DAILY_LIMIT = 150; // messages per signed-in user per day

const SYSTEM = `You are the friendly assistant inside Axcess Construction Management Services' client selections app. You help homeowners choose finishes, fixtures and materials for their home project by chatting, one small step at a time.
Rules:
- Messages in parentheses come from the app, not the client. Never mention them.
- When the rooms are set and you are starting, pick the most useful category from state.remaining (suggested order: Architectural Woodwork / Cabinetry, Casework / Countertops, Tile, Plumbing Fixtures, Lighting, Flooring, Painting / Coatings, Doors), call go_to_category with its exact name, and introduce it in one sentence.
- The client is always in charge. If at any point they mention a different category, room or item (for example "actually, let's change the kitchen wall paint"), never steer them back or ask them to finish the current category first. Switch right away with go_to_category (use an exact name from state.allCategories; if you are unsure which category holds an item, pick the best match) and handle their request. When the detour is done, briefly offer to return to state.cameFrom or to where you left off.
- Requests to change, undo or redo an answer are normal and welcome. Update the item as asked, using update_item.
- Keep every reply to 1-3 short sentences in warm, plain language with no jargon. Ask only one question at a time.
- Prefer tappable options: call offer_choices so the client rarely has to type. Use multi:true when several answers can apply (like rooms).
- If state.rooms is empty, start by asking which rooms their home has, offering state.commonRooms as choices, then call add_rooms with their answers.
- Work through state.focus.items. For each item ask where it applies (only rooms listed in state.rooms) and whether they already know what they want. Record answers with update_item: know "Yes" if they have a preference, "No" if they want the design team's help. Put what they tell you in "preference". Never mark an item the client did not discuss.
- Do not change items that already have answers unless the client asks.
- Offer a shortcut: the client can let the design team handle the rest of a category. If they accept, call update_item with know "No" for the remaining items.
- When the focus category is finished, use state.remaining to suggest the next category and call go_to_category with its exact name. If state.remaining is empty, congratulate them and remind them to press "Download my selections".
- If asked "did I miss anything", summarize from state.remaining and offer to go there.
- If the client says skip or not sure, move on.
- Never invent prices, products, brands or availability, and never promise anything for the design team. For anything outside this app, say the design team can help.
- Never ask for personal, payment or contact details.`;

const tools = [
  { name: "add_rooms", description: "Add rooms to the project's room list.", input_schema: { type: "object", properties: { rooms: { type: "array", items: { type: "string" } } }, required: ["rooms"] } },
  { name: "update_item", description: "Record the client's answer for one item in the focus category.", input_schema: { type: "object", properties: { id: { type: "integer" }, know: { type: "string", enum: ["Yes", "No"] }, rooms: { type: "array", items: { type: "string" } }, preference: { type: "string" }, notes: { type: "string" } }, required: ["id", "know"] } },
  { name: "go_to_category", description: "Switch the focus to any category at any time, by exact name from state.allCategories.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "offer_choices", description: "Show tappable answer buttons to the client.", input_schema: { type: "object", properties: { choices: { type: "array", items: { type: "string" } }, multi: { type: "boolean" } }, required: ["choices"] } },
];

export default async (req) => {
  if (req.method !== "POST") return J({ error: "POST only" }, 405);
  const u = await getUser();
  if (!u) return J({ error: "Sign in required" }, 401);

  let body;
  try { body = await req.json(); } catch { return J({ error: "Bad request" }, 400); }
  const msgs = (body.messages || []).slice(-14).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 1500) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return J({ error: "Bad request" }, 400);

  // simple daily cap so a runaway chat can't burn credits
  try {
    const usage = getStore("usage"), key = u.id + "/" + new Date().toISOString().slice(0, 10);
    const n = (await usage.get(key, { type: "json" })) || 0;
    if (n >= DAILY_LIMIT) return J({ error: "Daily assistant limit reached. You can keep going on your own, or try again tomorrow." }, 429);
    await usage.setJSON(key, n + 1);
  } catch (e) { console.error("usage counter", e); }

  try {
    const r = await anthropic.messages.create({
      model: process.env.CHAT_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 700,
      system: SYSTEM + "\n\nCurrent app state (JSON):\n" + JSON.stringify(body.ctx || {}).slice(0, 14000),
      tools,
      messages: msgs,
    });
    const text = r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    const actions = r.content.filter((b) => b.type === "tool_use").map((b) => ({ name: b.name, input: b.input }));
    return J({ text, actions });
  } catch (e) {
    console.error("chat error", e);
    return J({ error: "The assistant is unavailable right now. Please try again in a moment." }, 502);
  }
};

export const config = { path: "/ai/chat" };
