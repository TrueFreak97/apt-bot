import fetch from "node-fetch";
import fs from "fs";

// ===== CONFIG =====
const DISCORD_WEBHOOK = "https://discord.com/api/webhooks/1488203833069797527/xPbEyhIB8R8PB6DvsIFuoKc9mE-gagSogOX9X2QKBEr3mJ_XMBaFdqMMJTotmYnZSRCZ";
const FILE = "./seen.json";
const INTERVAL = 2 * 60 * 1000; // 2 minutes

// ===== helpers =====
function loadSeen() {
  if (!fs.existsSync(FILE)) return new Set();
  return new Set(JSON.parse(fs.readFileSync(FILE)));
}

function saveSeen(set) {
  fs.writeFileSync(FILE, JSON.stringify([...set]));
}

async function sendDiscord(message) {
  try {
    const res = await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: message })
    });

    if (res.status !== 204) {
      console.log("Discord error:", res.status);
    }
  } catch (err) {
    console.log("Discord failed:", err.message);
  }
}

// ===== API =====
async function fetchListings() {
  const URL =
    "https://apigw.prod.quintoandar.com.br/house-listing-search/v2/search/list";

  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json",
      "user-agent": "Mozilla/5.0"
    },
    body: JSON.stringify({
      context: {
        mapShowing: true,
        listShowing: false
      },
      filters: {
        businessContext: "RENT",
        location: {
          coordinate: { lat: -22.906847, lng: -43.172897 },
          viewport: {
            east: -43.13204159228517,
            north: -22.85607971026812,
            south: -23.07830275936493,
            west: -43.287223477050794
          },
          countryCode: "BR"
        },
        priceRange: [{
          costType: "TOTAL_COST",
          range: { min: 500, max: 6200 }
        }],
        houseSpecs: {
          area: { range: { min: 50, max: 1000 } },
          isFurnished: true,
          nearSubway: true,
          bathrooms: { range: {} },
          bedrooms: { range: {} },
          parkingSpace: { range: {} },
          suites: { range: {} }
        },
        availability: "ANY",
        occupancy: "ANY"
      },
      sorting: {
        criteria: "MOST_RECENT",
        order: "DESC"
      },
      pagination: {
        pageSize: 5,
        offset: 0
      },
      slug: "rio-de-janeiro-rj-brasil",
      fields: [
        "id",
        "totalCost",
        "rent",
        "area",
        "bedrooms",
        "bathrooms"
      ],
      locationDescriptions: [
        { description: "rio-de-janeiro-rj-brasil" }
      ]
    })
  });

  const data = await res.json();
  return data.hits?.hits || [];
}

// ===== MAIN =====
async function check() {
  try {
    const listings = await fetchListings();
    console.log(`[${new Date().toLocaleTimeString()}] Fetched: ${listings.length}`);

    const seen = loadSeen();

    for (const l of listings) {
      const apt = l._source;
      if (!apt) continue;

      const id = apt.id;

      if (!seen.has(id)) {
        const msg =
          `🏠 **New Apartment**\n` +
          `💰 R$ ${apt.totalCost}\n` +
          `🛏 ${apt.bedrooms} beds | 🛁 ${apt.bathrooms} baths\n` +
          `📐 ${apt.area}m²\n` +
          `https://www.quintoandar.com.br/imovel/${apt.id}`;

        console.log(msg);
        console.log("-----");

        await sendDiscord(msg);
        seen.add(id);
      }
    }

    saveSeen(seen);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}

// ===== RUN FOREVER =====
setInterval(check, INTERVAL);
check();
