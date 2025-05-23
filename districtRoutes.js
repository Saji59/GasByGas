const express = require("express");
const admin = require("firebase-admin");
const router = express.Router();

const db = admin.firestore();
const districtsCollection = db.collection("District");
const counterDoc = db.collection("counters").doc("districtCounter");

// Function to get the next DistrictID
async function getNextDistrictID() {
    const counterSnap = await counterDoc.get();
    let currentID = 0;

    if (counterSnap.exists) {
        currentID = counterSnap.data().lastDistrictID;
    }

    const newID = currentID + 1;
    await counterDoc.set({ lastDistrictID: newID });
    return newID;
}

// //  Create District
// router.post("/api/districts", async (req, res) => {
//     try {
//         const { DistrictName } = req.body;
//         if (!DistrictName) {
//             return res.status(400).json({ message: "DistrictName is required" });
//         }

//         const newID = await getNextDistrictID();
//         const districtData = { DistrictID: newID, DistrictName };

//         await districtsCollection.doc(newID.toString()).set(districtData);
//         res.status(201).json({ message: "District created successfully", district: districtData });

//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

// Get All Districts
router.get("/api/districts", async (req, res) => {
    try {
        const snapshot = await districtsCollection.orderBy("DistrictID").get();
        const districts = snapshot.docs.map(doc => doc.data());

        res.json({ districts, totalDistricts: districts.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get District by ID
router.get("/api/districts/:id", async (req, res) => {
    try {
        const districtSnap = await districtsCollection.doc(req.params.id).get();
        if (!districtSnap.exists) {
            return res.status(404).json({ message: "District not found" });
        }
        res.json(districtSnap.data());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update District
router.put("/api/districts/:id", async (req, res) => {
    try {
        const { DistrictName } = req.body;
        const districtRef = districtsCollection.doc(req.params.id);

        if (!(await districtRef.get()).exists) {
            return res.status(404).json({ message: "District not found" });
        }

        await districtRef.update({ DistrictName });
        res.json({ message: "District updated successfully" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;
