require("dotenv").config();
const express = require("express");
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json()); // ✅ body-parser not needed in express 5

// -------------------- FIREBASE ---------------------

// ✅ IMPORTANT: This must use ENV, NOT local file for cloud
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// -------------------- TEST ROUTE ---------------------
app.get("/", (req, res) => {
  res.send("✅ Smart Vehicle Backend is Live!");
});

// -------------------- FIND NEAREST ---------------------
app.post("/nearest", async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Missing coordinates" });
  }

  try {
    const mechSnap = await db.collection("mechanics").get();
    const ambSnap = await db.collection("ambulances").get();

    function calcDist(lat1, lon1, lat2, lon2) {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) ** 2;

      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    let nearestMech = null;
    let nearestAmb = null;
    let minMechDist = Infinity;
    let minAmbDist = Infinity;

    mechSnap.forEach((doc) => {
      const data = doc.data();
      if (!data.latitude || !data.longitude) return;

      const dist = calcDist(latitude, longitude, data.latitude, data.longitude);

      if (dist < minMechDist) {
        minMechDist = dist;
        nearestMech = { id: doc.id, ...data, distance: dist };
      }
    });

    ambSnap.forEach((doc) => {
      const data = doc.data();
      if (!data.latitude || !data.longitude) return;

      const dist = calcDist(latitude, longitude, data.latitude, data.longitude);

      if (dist < minAmbDist) {
        minAmbDist = dist;
        nearestAmb = { id: doc.id, ...data, distance: dist };
      }
    });

    return res.json({
      nearestMechanic: nearestMech,
      nearestAmbulance: nearestAmb,
    });
  } catch (err) {
    console.log("❌ NEAREST ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

// -------------------- START SERVER ---------------------

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
