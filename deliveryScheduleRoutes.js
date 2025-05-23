const express = require("express");
const admin = require("firebase-admin");
const { verifyAdmin, verifyAdminOutlets } = require("./index");

const router = express.Router();

const db = admin.firestore();
const schedulesCollection = db.collection("deliverySchedules");
const counterDoc = db.collection("counters").doc("deliveryScheduleCounter");
const outletCylinderDeliveryDetailsCollection = db.collection('OutletCylinderDeliveryDetails');


async function getNextScheduleID() {
    const counterSnap = await counterDoc.get();
    let currentID = 0;

    if (counterSnap.exists) {
        currentID = counterSnap.data().lastScheduleID;
    }

    const newID = currentID + 1;
    await counterDoc.set({ lastScheduleID: newID });
    return newID;
}

// Middleware to update Driver 
const updateDriver = async (req, res, next) => {
    try {
        let driverStatus = "Available";
        const { DriverID, Status } = req.body; 
        const scheduleID = req.params.id;
        let isDriverChanged = false;
        let oldDriverID = "";

        if (!DriverID) {
            return res.status(400).json({ error: "DriverID is required" });
        }

        if (scheduleID) {
            const scheduleRef = schedulesCollection.doc(scheduleID);
            const scheduleSnapshot = await scheduleRef.get();
    
            if (!scheduleSnapshot.exists) {
                return res.status(404).json({ error: "Schedule not found" });
            }

            const scheduleData = scheduleSnapshot.data(); 

            if (scheduleData.DriverID !== DriverID) {
                isDriverChanged = true;
                oldDriverID = scheduleData.DriverID;
            }
        }

        if (Status === undefined) {
            driverStatus = "Engaged";
        } else {
            switch (Status) {
                case "Scheduled":
                    driverStatus = "Engaged";
                    break;
                case "Shipped":
                    driverStatus = "Driving";
                    break;
                default:
                    driverStatus = "Available";
                    break;
            }
        }

        const driverRef = db.collection("Drivers").doc(DriverID);
        const driverDoc = await driverRef.get();

        if (!driverDoc.exists) {
            return res.status(404).json({ error: "Driver not found in Firestore" });
        }

        await driverRef.update({ Status: driverStatus });

        if (isDriverChanged && oldDriverID) {
            const oldDriverRef = db.collection("Drivers").doc(oldDriverID);
            await oldDriverRef.update({ Status: "Available" });
        }

        next(); 
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

  



// add new schedules api
router.post("/api/schedules", verifyAdmin,updateDriver, async (req, res) => {
    try {
        const {
            OutletID,
            ExpectedDeliveryDate,
            DriverID,
            Note,
            VehicleNumber,
            Kg2_3LPGasQuantity,
            Kg5LPGasQuantity,
            Kg12_5LPGasQuantity,
            Kg37_5LPGasQuantity,
            Kg47_5LPGasQuantity
        } = req.body;

        if (!OutletID || !ExpectedDeliveryDate || !DriverID) {
            return res.status(400).json({ message: "OutletID, ExpectedDeliveryDate, DriverID are required" });
        }
        // console.log("Kg2_3LPGasQuantity" +" is "+ Kg2_3LPGasQuantity);
        // console.log("Kg5LPGasQuantity" +" is "+ Kg5LPGasQuantity);
        // console.log("Kg12_5LPGasQuantity" +" is "+ Kg12_5LPGasQuantity);
        // console.log("Kg37_5LPGasQuantity" +" is "+ Kg37_5LPGasQuantity);
        // console.log("Kg47_5LPGasQuantity" +" is "+ Kg47_5LPGasQuantity);
        if (
            Kg2_3LPGasQuantity <= 0 &&
            Kg5LPGasQuantity <= 0 &&
            Kg12_5LPGasQuantity <= 0 &&
            Kg37_5LPGasQuantity <= 0 &&
            Kg47_5LPGasQuantity <= 0
        ) {
            return res.status(400).json({ message: "LP Gas quantities must be positive numbers" });
        }

        const Status = "Scheduled";
        const newID = await getNextScheduleID();
        const scheduleData = {
            ScheduleID: newID,
            OutletID : parseInt(OutletID,10),
            CreatedDate: new Date().toISOString(),
            ExpectedDeliveryDate,
            DeliveryDate: null,
            DriverID,
            VehicleNumber,
            Status,
            Note: Note || "",
            Kg2_3LPGasQuantity,
            Kg5LPGasQuantity,
            Kg12_5LPGasQuantity,
            Kg37_5LPGasQuantity,
            Kg47_5LPGasQuantity
        };

        await schedulesCollection.doc(newID.toString()).set(scheduleData);

        res.status(201).json({ message: "Schedule created successfully", schedule: scheduleData });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//  Get All Delivery Schedules
router.get("/api/schedules", verifyAdminOutlets, async (req, res) => {
    try {
        if(req.user.userData.role === "OutManager001Man" ||req.user.userData.role === "OutManager001" )
        {
            const snapshot = await schedulesCollection
            .where("OutletID", "==" ,parseInt(req.user.userData.outletID,10))
            .get();
            const schedules = snapshot.docs.map(doc => doc.data());
    
            res.json({ schedules, totalSchedules: schedules.length });
        }
        else
        {

            const snapshot = await schedulesCollection.orderBy("ScheduleID").get();
            const schedules = snapshot.docs.map(doc => doc.data());
    
            res.json({ schedules, totalSchedules: schedules.length });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
        console.log(error.message);
    }
});

//  Get Schedule by ID
router.get("/api/schedules/:id", verifyAdmin, async (req, res) => {
    try {
        const scheduleSnap = await schedulesCollection.doc(req.params.id).get();
        if (!scheduleSnap.exists) {
            return res.status(404).json({ message: "Schedule not found" });
        }
        res.json(scheduleSnap.data());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Schedule with LP Gas Quantities and Create OutletCylinderDeliveryDetails
router.put("/api/schedules/:id", verifyAdminOutlets,updateDriver, async (req, res) => {
    try {
       // console.log("calling API");
        const {
            ExpectedDeliveryDate,
            DeliveryDate,
            DriverID,
            Status,
            Note,
            VehicleNumber,
            Kg2_3LPGasQuantity,
            Kg5LPGasQuantity,
            Kg12_5LPGasQuantity,
            Kg37_5LPGasQuantity,
            Kg47_5LPGasQuantity
        } = req.body;
        const scheduleRef = schedulesCollection.doc(req.params.id);
        const scheduleSnapshot = await scheduleRef.get();

        if (!scheduleSnapshot.exists) {
            return res.status(404).json({ message: "Schedule not found" });
        }

        const scheduleData = scheduleSnapshot.data();
        const outletID = parseInt(scheduleData.OutletID,10);

        if (
            Kg2_3LPGasQuantity <= 0 &&
            Kg5LPGasQuantity <= 0 &&
            Kg12_5LPGasQuantity <= 0 &&
            Kg37_5LPGasQuantity <= 0 &&
            Kg47_5LPGasQuantity <= 0
        ) {
            return res.status(400).json({ message: "LP Gas quantities must be positive numbers" });
        }
        const deliveryDate = new Date().toISOString();
       
       // console.log("start .update");
        await scheduleRef.update({
            ExpectedDeliveryDate,
            DeliveryDate: Status === "Delivered" ? deliveryDate : null,
            DriverID,
            Status,
            Note,
            VehicleNumber,
            Kg2_3LPGasQuantity,
            Kg5LPGasQuantity,
            Kg12_5LPGasQuantity,
            Kg37_5LPGasQuantity,
            Kg47_5LPGasQuantity
        });
        // console.log("end .update");
        if (Status === "Delivered") {
            //console.log("Status === Delivered");
            const outletCylinderDeliveryCollection = db.collection("OutletCylinderDeliveryDetails");
           
            
            const cylinders = [
                { CylinderID: 1, Quantity: Kg2_3LPGasQuantity },
                { CylinderID: 2, Quantity: Kg5LPGasQuantity },
                { CylinderID: 3, Quantity: Kg12_5LPGasQuantity },
                { CylinderID: 4, Quantity: Kg37_5LPGasQuantity },
                { CylinderID: 5, Quantity: Kg47_5LPGasQuantity }
            ];

            const validCylinders = cylinders.filter(c => c.Quantity > 0);

            for (const cylinder of validCylinders) {
                await outletCylinderDeliveryCollection.add({
                    DeliveryDate: deliveryDate,
                    CylinderID: cylinder.CylinderID,
                    RecivedCylinders: cylinder.Quantity,
                    OutletID: parseInt(outletID,10),
                    ScheduleID: req.params.id
                });
            }
        }

        res.json({ message: "Schedule updated successfully" });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//get recived cylinder details by outlet id
router.get("/api/outlet-cylinder-details/:outletId", async (req, res) => {
    try {
        const outletId = parseInt( req.params.outletId,10);
        const snapshot = await db.collection("OutletCylinderDeliveryDetails")
            .where("OutletID", "==", outletId)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ message: "No delivery details found for this outlet" });
        }

        // Group by CylinderID and sum RecivedCylinders
        const cylinderSummary = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const { CylinderID, RecivedCylinders } = data;
            
            if (!cylinderSummary[CylinderID]) {
                cylinderSummary[CylinderID] = 0;
            }
            cylinderSummary[CylinderID] += RecivedCylinders;
        });

        res.json({ outletId, cylinderSummary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

//get recived cylinder details by outlet id with date range
router.get("/api/outlet-cylinder-details/:outletId/:fromDate/:toDate", async (req, res) => {
    try {
        const { outletId, fromDate, toDate } = req.params;

        const snapshot = await db.collection("OutletCylinderDeliveryDetails")
            .where("OutletID", "==", parseInt(outletId,10))
            .where("DeliveryDate", ">=", fromDate)
            .where("DeliveryDate", "<=", toDate)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ message: "No delivery details found for this date range" });
        }

        // Group by CylinderID and sum RecivedCylinders
        const cylinderSummary = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const { CylinderID, RecivedCylinders } = data;
            
            if (!cylinderSummary[CylinderID]) {
                cylinderSummary[CylinderID] = 0;
            }
            cylinderSummary[CylinderID] += RecivedCylinders;
        });

        res.json({ outletId, fromDate, toDate, cylinderSummary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/api/delivery-schedules/:outletId", async (req, res) => {
    try {
        const outletId = req.params.outletId;

        const snapshot = await db.collection("DeliverySchedule")
            .where("OutletID", "==", outletId)
            .where("Status", "in", ["Scheduled", "Shipped"])
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ message: "No scheduled or shipped deliveries found for this outlet" });
        }

        // Group by CylinderID instead of LPGasQuantity
        const cylinderSummary = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.Kg2_3LPGasQuantity > 0) {
                cylinderSummary["1"] = (cylinderSummary["1"] || 0) + data.Kg2_3LPGasQuantity;
            }
            if (data.Kg5LPGasQuantity > 0) {
                cylinderSummary["2"] = (cylinderSummary["2"] || 0) + data.Kg5LPGasQuantity;
            }
            if (data.Kg12_5LPGasQuantity > 0) {
                cylinderSummary["3"] = (cylinderSummary["3"] || 0) + data.Kg12_5LPGasQuantity;
            }
            if (data.Kg37_5LPGasQuantity > 0) {
                cylinderSummary["4"] = (cylinderSummary["4"] || 0) + data.Kg37_5LPGasQuantity;
            }
            if (data.Kg47_5LPGasQuantity > 0) {
                cylinderSummary["5"] = (cylinderSummary["5"] || 0) + data.Kg47_5LPGasQuantity;
            }
        });

        res.json({ outletId, gasSummary: cylinderSummary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get total delivery quantity grouped by outletId
router.get("/api/delivery/total-by-outlet",verifyAdmin, async (req, res) => {
    try {
        const outletId = parseInt(req.query.outletId,10);

        if (!outletId) {
            return res.status(400).json({ message: "Outlet ID is required" });
        }

        const snapshot = await outletCylinderDeliveryDetailsCollection
            .where("OutletID", "==", outletId)
            .get();

        if (snapshot.empty) {
            return res.status(404).json({ message: "No deliveries found for this outlet" });
        }

        const gasSummary = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Parse RecivedCylinders to an integer
            const receivedCylinders = Number(data.RecivedCylinders);
            
            // Aggregate received cylinders by CylinderID if it's a valid number and greater than 0
            if (data.CylinderID && !isNaN(receivedCylinders) && receivedCylinders > 0) {
                gasSummary[data.CylinderID] = (gasSummary[data.CylinderID] || 0) + receivedCylinders;
            }
        });

        res.json({
            outletId,
            gasSummary,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get total delivery quantity for all deliveries 
router.get("/api/delivery/total",verifyAdmin, async (req, res) => {
    try {
        const snapshot = await outletCylinderDeliveryDetailsCollection.get();

        if (snapshot.empty) {
            return res.status(404).json({ message: "No deliveries found" });
        }

        let totalQuantity = 0;

        snapshot.forEach(doc => {
            const data = doc.data();

           const receivedCylinders = Number(data.RecivedCylinders);
            if (isNaN(receivedCylinders)) {
                totalQuantity += 0;  // Default to 0 if it's not a valid number
            } else if (receivedCylinders > 0) {
                totalQuantity += receivedCylinders;
            }
        });

        res.json({
            totalDeliveryQuantity: totalQuantity,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



module.exports = router;
