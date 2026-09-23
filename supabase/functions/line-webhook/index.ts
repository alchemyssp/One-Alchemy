import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// LINE OA webhook (Supabase Edge Function "line-webhook")
//   Rich Menu "Outlet Info" / "Product" sets the user's search mode (line_user_mode) and asks for a name;
//   the next messages are searched ONLY in that mode:
//     outlet  → search_outlets  → Outlet Info card(s) only
//     product → search_products → product card(s)
//   no mode yet → a short hint with quick-reply buttons (no data sent)
// Outlet data comes from the "Outlet Master" view, so it is always in sync with Data Universe.

// Only accept requests signed by LINE (correct LINE_CHANNEL_SECRET set on 2026-09-23)
const REQUIRE_SIGNATURE = true;

const env = (k: string) => (Deno.env.get(k) ?? "").trim();
const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
// tokens pasted from a browser sometimes carry invisible characters (or a "Bearer " prefix)
// that make HTTP headers invalid — keep only the characters a LINE token/secret can contain
const asciiOnly = (s: string) => s.replace(/^Bearer\s+/i, "").replace(/[^!-~]/g, "");
const LINE_TOKEN = asciiOnly(env("LINE_CHANNEL_ACCESS_TOKEN"));
const LINE_SECRET = asciiOnly(env("LINE_CHANNEL_SECRET"));
// Outlet lookup now lives here, so forwarding to the old Vercel bot is OFF unless FORWARD_WEBHOOK_URL is set
const FORWARD_URL = env("FORWARD_WEBHOOK_URL");
const MIN_SCORE = 0.8;

const RED = "#D7193A";
const INK = "#111111";
const MUTED = "#999999";

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const baht = (n: number | null) =>
  n === null ? "-" : new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 }).format(n);

const imageUrl = (p: string | null) =>
  p ? SUPABASE_URL + "/storage/v1/object/public/product-images/" + encodeURIComponent(p) : null;

const clean = (v: unknown) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return s || "-";
};

async function signatureOk(body: string, signature: string): Promise<boolean> {
  if (!signature || !LINE_SECRET) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(LINE_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(mac))) === signature;
}

/* ── Product card (unchanged) ── */
function bubble(p: any) {
  const img = imageUrl(p.image_path);
  const detail = [p.size, p.abv].filter(Boolean).join("  |  ");
  const b: any = {
    type: "bubble", size: "kilo",
    body: { type: "box", layout: "vertical", spacing: "sm", contents: [
      { type: "text", text: p.category, size: "xxs", color: "#8B1A1A", weight: "bold" },
      { type: "text", text: p.name, weight: "bold", size: "sm", wrap: true, maxLines: 3 },
      { type: "text", text: detail || " ", size: "xs", color: "#888888" },
      { type: "text", text: "B " + baht(p.price_thb), weight: "bold", size: "lg", color: "#8B1A1A", margin: "sm" },
      { type: "text", text: "ราคายังไม่รวม VAT", size: "xxs", color: "#AAAAAA" },
    ] },
  };
  if (img) b.hero = { type: "image", url: img, size: "full", aspectRatio: "1:1", aspectMode: "fit", backgroundColor: "#FFFFFF" };
  return b;
}

/* ── Outlet card: "Outlet Info" header, name, code + Copy, company, group/team/BDE/area ── */
function outletBubble(o: any) {
  const code = clean(o.outlet_code);
  const row = (label: string, value: unknown) => ({
    type: "box", layout: "baseline", spacing: "md", contents: [
      { type: "text", text: label, size: "sm", color: MUTED, flex: 3 },
      { type: "text", text: clean(value), size: "sm", color: INK, weight: "bold", flex: 6, wrap: true },
    ],
  });
  return {
    type: "bubble", size: "kilo",
    header: {
      type: "box", layout: "vertical", backgroundColor: RED, paddingAll: "12px",
      contents: [{ type: "text", text: "Outlet Info", color: "#FFFFFF", weight: "bold", size: "sm" }],
    },
    body: {
      type: "box", layout: "vertical", spacing: "md", paddingAll: "16px",
      contents: [
        { type: "text", text: clean(o.outlet_name), weight: "bold", size: "lg", color: INK, wrap: true },
        {
          type: "box", layout: "horizontal", alignItems: "center", contents: [
            { type: "text", text: code, size: "sm", color: MUTED, flex: 1, wrap: true },
            {
              type: "box", layout: "vertical", flex: 0, backgroundColor: "#EEEEEE", cornerRadius: "12px",
              paddingStart: "12px", paddingEnd: "12px", paddingTop: "4px", paddingBottom: "4px",
              action: { type: "clipboard", label: "Copy", clipboardText: code },
              contents: [{ type: "text", text: "Copy", size: "xs", color: "#333333" }],
            },
          ],
        },
        { type: "separator", color: "#EEEEEE" },
        {
          type: "box", layout: "vertical", spacing: "xs", contents: [
            { type: "text", text: "COMPANY NAME", size: "xxs", color: RED, weight: "bold" },
            { type: "text", text: clean(o.company_name), size: "sm", color: INK, weight: "bold", wrap: true },
          ],
        },
        { type: "separator", color: "#EEEEEE" },
        {
          type: "box", layout: "vertical", spacing: "sm", contents: [
            row("Group", o.group_name || "UNCATEGORIZED"),
            row("Team", o.team),
            row("BDE", o.bde),
            row("Area", o.area),
          ],
        },
      ],
    },
  };
}

async function reply(token: string, messages: unknown[]) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + LINE_TOKEN },
    body: JSON.stringify({ replyToken: token, messages }),
  });
  if (!res.ok) console.error("LINE reply failed " + res.status + " " + await res.text() +
    (res.status === 401 ? "  → LINE_CHANNEL_ACCESS_TOKEN is wrong or expired" : ""));
  return res.ok;
}

async function log(ev: any, q: string, count: number, productId: unknown = null) {
  const { error } = await db.from("line_search_log").insert({
    line_user_id: ev.source?.userId ?? null, query: q,
    matched_count: count, top_product_id: productId,
  });
  if (error) console.warn("log failed", error.message);
}

async function replyOutlets(ev: any, q: string): Promise<boolean> {
  const { data, error } = await db.rpc("search_outlets", { q, max_results: 10 });
  if (error) { console.error("outlet search failed", error); return false; }
  const rows = (data ?? []) as any[];
  console.log("outlet query=\"" + q + "\" hits=" + rows.length);
  if (!rows.length) return false;

  const card = rows.length === 1
    ? { type: "flex", altText: "Outlet Info: " + clean(rows[0].outlet_name), contents: outletBubble(rows[0]) }
    : { type: "flex", altText: "พบร้าน " + rows.length + " รายการ", contents: { type: "carousel", contents: rows.map(outletBubble) } };
  // card(s) only — the Copy button on each card copies the Outlet Code
  await reply(ev.replyToken, [card]);
  await log(ev, q, rows.length);
  return true;
}

/* ── Search mode (Rich Menu): the user picks "Outlet Info" or "Product" first,
      then only that kind of data is sent. Mode is kept in line_user_mode. ── */
type Mode = "outlet" | "product";
const norm = (s: string) => s.toLowerCase().replace(/[\s._-]+/g, "");
/* texts the Rich Menu buttons may send (compared lower-case, without spaces) */
const OUTLET_TRIGGERS = ["outletinfo", "outlet", "outlets", "outletlist", "outletslist", "checkoutlet", "เช็คoutlet",
  "เช็คoutletinfo", "ร้านค้า", "ร้าน", "เช็คร้าน", "เช็คร้านค้า", "ข้อมูลร้านค้า", "เช็คข้อมูลร้านค้า"];
const PRODUCT_TRIGGERS = ["product", "products", "productlist", "productslist", "productinfo", "checkproduct", "เช็คproduct",
  "สินค้า", "เช็คสินค้า", "รายการสินค้า", "ข้อมูลสินค้า", "เช็คข้อมูลสินค้า"];

const PROMPT: Record<Mode, string> = {
  outlet: "Outlet Info\nพิมพ์ชื่อร้าน (บางส่วนก็ได้) หรือ Outlet Code ที่ต้องการค้นหาได้เลยค่ะ",
  product: "Product\nพิมพ์ชื่อสินค้า หรือแบรนด์ ที่ต้องการค้นหาได้เลยค่ะ",
};
const quickMenu = {
  items: [
    { type: "action", action: { type: "message", label: "Outlet Info", text: "Outlet Info" } },
    { type: "action", action: { type: "message", label: "Product", text: "Product" } },
  ],
};
const text = (t: string, withMenu = false) => (withMenu ? { type: "text", text: t, quickReply: quickMenu } : { type: "text", text: t });

async function getMode(userId: string | null): Promise<Mode | null> {
  if (!userId) return null;
  const { data } = await db.from("line_user_mode").select("mode").eq("line_user_id", userId).maybeSingle();
  return (data?.mode as Mode) ?? null;
}
async function setMode(userId: string | null, mode: Mode) {
  if (!userId) return;
  const { error } = await db.from("line_user_mode")
    .upsert({ line_user_id: userId, mode, updated_at: new Date().toISOString() }, { onConflict: "line_user_id" });
  if (error) console.warn("set mode failed", error.message);
}

async function searchProducts(ev: any, q: string): Promise<boolean> {
  const { data, error } = await db.rpc("search_products", { q, max_results: 6 });
  if (error) console.error("search failed", error);
  const rows = (data ?? []) as any[];
  const top = rows.length ? Number(rows[0].score) : 0;
  console.log("product query=\"" + q + "\" hits=" + rows.length + " top=" + top);
  if (!rows.length || top < MIN_SCORE) return false;
  const messages = rows.length === 1
    ? [{ type: "flex", altText: rows[0].name, contents: bubble(rows[0]) }]
    : [{ type: "flex", altText: "พบ " + rows.length + " รายการ", contents: { type: "carousel", contents: rows.map(bubble) } }];
  await reply(ev.replyToken, messages);
  await log(ev, q, rows.length, rows[0].id);
  return true;
}

async function handleEvent(ev: any): Promise<boolean> {
  const userId = ev.source?.userId ?? null;

  // Rich Menu postback (if the menu is set up with postback actions: data "mode=outlet" / "mode=product")
  if (ev.type === "postback") {
    const m = String(ev.postback?.data ?? "").match(/mode=(outlet|product)/);
    if (!m) return false;
    await setMode(userId, m[1] as Mode);
    await reply(ev.replyToken, [text(PROMPT[m[1] as Mode])]);
    return true;
  }

  if (ev.type !== "message" || ev.message?.type !== "text") return false;
  const q = String(ev.message.text ?? "").trim().slice(0, 100);
  if (!q) return false;

  // Rich Menu text actions: "Outlet Info" / "Product"
  const n = norm(q);
  if (OUTLET_TRIGGERS.includes(n) || PRODUCT_TRIGGERS.includes(n)) {
    const mode: Mode = OUTLET_TRIGGERS.includes(n) ? "outlet" : "product";
    await setMode(userId, mode);
    await reply(ev.replyToken, [text(PROMPT[mode])]);
    return true;
  }

  const mode = await getMode(userId);
  if (!mode) {
    await reply(ev.replyToken, [text("กรุณากดเมนู Outlet Info หรือ Product ด้านล่างก่อน แล้วพิมพ์ชื่อที่ต้องการค้นหาค่ะ", true)]);
    return true;
  }
  if (q.length < 2) {
    await reply(ev.replyToken, [text("พิมพ์อย่างน้อย 2 ตัวอักษรนะคะ")]);
    return true;
  }

  if (mode === "outlet") {
    if (await replyOutlets(ev, q)) return true;
    await reply(ev.replyToken, [text("ไม่พบร้าน \"" + q + "\"\nลองพิมพ์ชื่อร้านบางส่วน หรือ Outlet Code อีกครั้งค่ะ", true)]);
    await log(ev, q, 0);
    return true;
  }

  if (await searchProducts(ev, q)) return true;
  await reply(ev.replyToken, [text("ไม่พบสินค้า \"" + q + "\"\nลองพิมพ์ชื่อสินค้า หรือแบรนด์ อีกครั้งค่ะ", true)]);
  await log(ev, q, 0);
  return true;
}
async function forward(raw: string, signature: string) {
  if (!FORWARD_URL || FORWARD_URL === "off") return;
  try {
    const res = await fetch(FORWARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-line-signature": signature },
      body: raw,
    });
    if (!res.ok) console.error("forward failed " + res.status);
  } catch (e) { console.error("forward threw", e); }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({
      ok: true,
      require_signature: REQUIRE_SIGNATURE,
      channel_secret_length: LINE_SECRET.length,
      access_token_set: LINE_TOKEN.length > 0,
      access_token_length: LINE_TOKEN.length,
      access_token_had_bad_chars: LINE_TOKEN.length !== env("LINE_CHANNEL_ACCESS_TOKEN").length,
      forward_url: FORWARD_URL || "off",
      outlet_lookup: "Outlet Master view (search_outlets)",
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  const raw = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";
  const verified = await signatureOk(raw, signature);
  if (!verified) console.warn("signature not verified (enforcing=" + REQUIRE_SIGNATURE + ")");

  if (!verified && REQUIRE_SIGNATURE) {
    await forward(raw, signature);
    return new Response(JSON.stringify({ ok: true, forwarded: true }), { headers: { "Content-Type": "application/json" } });
  }

  let payload: any;
  try { payload = JSON.parse(raw); } catch { return new Response("bad request", { status: 400 }); }

  const events = Array.isArray(payload.events) ? payload.events : [];
  const results = await Promise.allSettled(
    events.map((ev: any) => handleEvent(ev).catch((e) => { console.error(e); return false; })),
  );
  const answeredAll = results.length > 0 &&
    results.every((r) => r.status === "fulfilled" && r.value === true);

  if (!answeredAll) await forward(raw, signature);

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
