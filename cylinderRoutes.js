const express = require("express");
const admin = require("firebase-admin");
const { verifyAdmin } = require("./index"); 

const router = express.Router();
const db = admin.firestore();

const cylindersCollection = db.collection("Cylinders");

// Function to generate an auto-incremented CylinderID
async function getNextCylinderID() {
    const snapshot = await cylindersCollection.orderBy("CylinderID", "desc").limit(1).get();
    if (snapshot.empty) return 1;
    return snapshot.docs[0].data().CylinderID + 1;
}

// Create Cylinder
router.post("/api/cylinders",verifyAdmin, async (req, res) => {
    try {
        const { Capacity, UsedFor } = req.body;
        if (!Capacity || !UsedFor) {
            return res.status(400).json({ message: "Capacity and used for are required" });
        }

        const newID = await getNextCylinderID();
        const cylinderData = { CylinderID: newID, Capacity, UsedFor };

        await cylindersCollection.doc(newID.toString()).set(cylinderData);
        res.status(201).json({ message: "Cylinder added successfully", cylinder: cylinderData });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get All Cylinders
router.get("/api/cylinders",async (req, res) => {
    try {
        const snapshot = await cylindersCollection.get();
        if (snapshot.empty) {
            return res.status(404).json({ message: "No cylinders found" });
        }

        const cylinders = snapshot.docs.map(doc => doc.data());
        res.json({ cylinders, totalCylinders: cylinders.length });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get Cylinder by ID
router.get("/api/cylinders/:id",verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await cylindersCollection.doc(id).get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Cylinder not found" });
        }
        res.json(doc.data());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update Cylinder
router.put("/api/cylinders/:id", verifyAdmin,async (req, res) => {
    try {
        const { id } = req.params;
        const { Capacity, UsedFor } = req.body;

        const docRef = cylindersCollection.doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Cylinder not found" });
        }

        await docRef.update({ Capacity, UsedFor });
        res.json({ message: "Cylinder updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Delete Cylinder
router.delete("/api/cylinders/:id",verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const docRef = cylindersCollection.doc(id);
        const doc = await docRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: "Cylinder not found" });
        }

        await docRef.delete();
        res.json({ message: "Cylinder deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
