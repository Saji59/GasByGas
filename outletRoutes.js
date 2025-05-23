const express = require("express");
const admin = require("firebase-admin");
const { verifyAdmin,verifyAdminOutlets } = require("./index"); 

const router = express.Router();
const db = admin.firestore();
const outletsCollection = db.collection("Outlets");


const getNextOutletID = async () => {
    const lastOutletSnapshot = await outletsCollection
        .orderBy("OutletID", "desc")
        .limit(1)
        .get();

    if (!lastOutletSnapshot.empty) {
        const lastOutlet = lastOutletSnapshot.docs[0].data();
        return lastOutlet.OutletID + 1;
    }
    return 1;
};
//Create outlet API
router.post("/api/outlets", verifyAdmin, async (req, res) => {
    try {
        const { OutletName, DistrictID, Address, ContactNumber, Status } = req.body;

        const existingOutlet = await outletsCollection
            .where("ContactNumber", "==", ContactNumber)
            .get();

        if (!existingOutlet.empty) {
            return res.status(400).json({ message: "Outlet with this contact number already exists." });
        }
        if (!OutletName || !DistrictID || !Address || !ContactNumber) {
            return res.status(400).json({ message: "OutletName, District, Address and ContactNumber are required" });
        }

        const newOutletID = await getNextOutletID(); 


        const newOutlet = {
            OutletID: newOutletID,
            OutletName,
            DistrictID,
            Address,
            ContactNumber,
            CreatedDate: new Date(),
            Status: Status || "Active",
        };
        const stringnewOutletID = newOutletID.toString().toString();
        await outletsCollection.doc(stringnewOutletID).set(newOutlet);
        res.status(201).json({ message: "Outlet created successfully", outlet: newOutlet });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//Get All outlets
router.get("/api/outlets",verifyAdminOutlets, async (req, res) => {
    try {
        const snapshot = await outletsCollection.get();
        if (snapshot.empty) {
            return res.status(404).json({ message: "No outlets found" });
        }

        const outlets = snapshot.docs.map(doc => {
            const data = doc.data();
            
           
            if (data.CreatedDate && data.CreatedDate._seconds) {
                const date = new Date(data.CreatedDate._seconds * 1000);
                data.CreatedDate = new Intl.DateTimeFormat("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                }).format(date);
            }
        
            return data;
        });
        
        const totalOutlets = outlets.length;

        
        res.json({outlets,totalOutlets});
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});


// get outletby id
router.get("/api/outlets/:OutletID",verifyAdmin, async (req, res) => {
    try {
        const { OutletID } = req.params;
        const stringOuteltID = OutletID.toString();
        const outletDoc = await outletsCollection.doc(stringOuteltID).get();

        if (!outletDoc.exists) {
            return res.status(404).json({ message: "Outlet not found" });
        }

        res.json(outletDoc.data());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get outlets by status
router.get("/api/outlets/status/:status", verifyAdminOutlets,async (req, res) => {
    try {
        let { status } = req.params; // Fix: Ensure correct destructuring
        if (!status) {
            return res.status(400).json({ message: "Status parameter is required" });
        }

        // Firestore queries are case-sensitive, so ensure correct case
        status = status.trim();

        const outletSnapshot = await outletsCollection.where("Status", "==", status).get();

        if (outletSnapshot.empty) {
            return res.status(404).json({ message: "No outlets found" });
        }

        const outlets = [];
        outletSnapshot.forEach((doc) => {
            outlets.push({ id: doc.id, ...doc.data() });
        });

        res.json(outlets);
    } catch (error) {
        console.error("Error fetching outlets:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

// Get Active outlets 
router.get("/api/outlets/activeoutlets", async (req, res) => {
    try {
        
        const outletSnapshot = await outletsCollection
            .where("Status", "==", "Active")
            .get();

        if (outletSnapshot.empty) {
            return res.status(404).json({ message: "No active outlets found in this district" });
        }

        const outlets = [];
        outletSnapshot.forEach((doc) => {
            outlets.push({ id: doc.id, ...doc.data() });
        });

        res.json(outlets);
    } catch (error) {
        console.error("Error fetching outlets:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});


// Get outlets by district ID where status is "Active"
router.get("/api/outlets/district/:districtId", async (req, res) => {
    try {
        const { districtId } = req.params;

        if (!districtId) {
            return res.status(400).json({ message: "District ID is required" });
        }

        const outletSnapshot = await outletsCollection
            .where("DistrictID", "==", districtId)
            .where("Status", "==", "Active")
            .get();

        if (outletSnapshot.empty) {
            return res.status(404).json({ message: "No active outlets found in this district" });
        }

        const outlets = [];
        outletSnapshot.forEach((doc) => {
            outlets.push({ id: doc.id, ...doc.data() });
        });

        res.json(outlets);
    } catch (error) {
        console.error("Error fetching outlets:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
});


// update outlet by id
router.put("/api/outlets/:OutletID",verifyAdmin, async (req, res) => {
    try {
        const { OutletID } = req.params;
        const stringOuteltID = OutletID.toString();

        const outletRef = outletsCollection.doc(stringOuteltID);
        const outletDoc = await outletRef.get();

        if (!outletDoc.exists) {
            return res.status(404).json({ message: "Outlet not found" });
        }

        await outletRef.update(req.body); 

        res.json({ message: "Outlet updated successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
