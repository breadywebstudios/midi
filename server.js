require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const Stripe = require("stripe");

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();

const PRODUCTS = JSON.parse(fs.readFileSync(path.join(__dirname, "data", "products.json"), "utf8"));
const MIDI_DIR = path.join(__dirname, "private", "midi");
const PUBLIC_DIR = path.join(__dirname, "public");

function findProduct(id) { return PRODUCTS.find((p) => p.id === id); }
function signDownloadToken(payload) { return jwt.sign(payload, process.env.DOWNLOAD_TOKEN_SECRET, { expiresIn: "24h" }); }
function verifyDownloadToken(token) { return jwt.verify(token, process.env.DOWNLOAD_TOKEN_SECRET); }

app.post("/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("Payment succeeded:", session.id, session.amount_total);
  }
  res.json({ received: true });
});

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

app.get("/api/products", (req, res) => {
  const safe = PRODUCTS.map((p) => ({
    id: p.id, title: p.title, artist: p.artist, description: p.description, youtubeId: p.youtubeId,
    tiers: {
      free:   { label: p.tiers.free.label,   price: p.tiers.free.price },
      chorus: { label: p.tiers.chorus.label, price: p.tiers.chorus.price },
      full:   { label: p.tiers.full.label,   price: p.tiers.full.price }
    }
  }));
  res.json(safe);
});

app.get("/api/products/:id", (req, res) => {
  const p = findProduct(req.params.id);
  if (!p) return res.status(404).json({ error: "Not found" });
  res.json({
    id: p.id, title: p.title, artist: p.artist, description: p.description, youtubeId: p.youtubeId,
    tiers: {
      free:   { label: p.tiers.free.label,   price: p.tiers.free.price },
      chorus: { label: p.tiers.chorus.label, price: p.tiers.chorus.price },
      full:   { label: p.tiers.full.label,   price: p.tiers.full.price }
    }
  });
});

app.get("/download/free/:productId", (req, res) => {
  const p = findProduct(req.params.productId);
  if (!p) return res.status(404).send("Product not found");
  const filePath = path.join(MIDI_DIR, p.tiers.free.file);
  if (!fs.existsSync(filePath)) return res.status(404).send("File missing");
  res.setHeader("Content-Type", "audio/midi");
  res.setHeader("Content-Disposition", `attachment; filename="${p.tiers.free.file}"`);
  fs.createReadStream(filePath).pipe(res);
});

app.post("/api/checkout", async (req, res) => {
  const { productId, tier } = req.body;
  const product = findProduct(productId);
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (!["chorus", "full"].includes(tier)) return res.status(400).json({ error: "Invalid tier" });
  const tierData = product.tiers[tier];
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `${product.title} â€” ${tierData.label}`,
            description: `By ${product.artist}. Includes tutorial link.`
          },
          unit_amount: tierData.price
        },
        quantity: 1
      }],
      metadata: { productId: product.id, tier },
      success_url: `${process.env.BASE_URL}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/song.html?id=${product.id}`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: "Could not create checkout session" });
  }
});

app.get("/api/verify-session", async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: "Missing session_id" });
  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") return res.status(402).json({ error: "Payment not completed" });
    const { productId, tier } = session.metadata;
    const product = findProduct(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });
    const token = signDownloadToken({ productId, tier, sessionId: session_id });
    res.json({
      productTitle: product.title,
      artist: product.artist,
      tier: product.tiers[tier].label,
      youtubeId: product.youtubeId,
      downloadUrl: `/download/paid?token=${token}`
    });
  } catch (err) {
    console.error("Verify error:", err);
    res.status(500).json({ error: "Could not verify session" });
  }
});

app.get("/download/paid", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).send("Missing token");
  let payload;
  try { payload = verifyDownloadToken(token); }
  catch { return res.status(401).send("Link expired or invalid"); }
  const product = findProduct(payload.productId);
  if (!product) return res.status(404).send("Product not found");
  const tierData = product.tiers[payload.tier];
  if (!tierData) return res.status(400).send("Invalid tier");
  const filePath = path.join(MIDI_DIR, tierData.file);
  if (!fs.existsSync(filePath)) return res.status(404).send("File missing");
  res.setHeader("Content-Type", "audio/midi");
  res.setHeader("Content-Disposition", `attachment; filename="${tierData.file}"`);
  fs.createReadStream(filePath).pipe(res);
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`MIDI store running on port ${process.env.PORT || 3000}`);
});