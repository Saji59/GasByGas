const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { admin, firestoredb } = require("./firebaseConfig"); 
const http = require('http');
const socketIo = require('socket.io');
const auth = admin.auth();
const db = firestoredb;


const driversCollection = db.collection("Drivers");



const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000', 
    methods: ['GET', 'POST']
  }
});
app.use(cors());
app.use(bodyParser.json());

// Example route to trigger an event
app.post('/trigger-event', (req, res) => {
  console.log("Event triggered called")
  io.emit('triggerFrontendFunction', { message: 'Triggering frontend function' });
  res.send({ status: 'Event triggered' });
});

// Middleware to Verify admin
const verifySuperAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(403).json({ error: "User not found in Firestore" });

    const userData = userDoc.data();
    if (userData.role !== "S000admin01admin" ) return res.status(403).json({ error: "Forbidden: Not an super admin" });

    req.user = userData; 
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token", details: error.message });
  }
};

// Middleware to Verify admin
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(403).json({ error: "User not found in Firestore" });

    const userData = userDoc.data();
    if (userData.role !== "S000admin01" && userData.role !== "S000admin01admin" ) return res.status(403).json({ error: "Forbidden: Not an admin" });

    req.user = userData; 
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token", details: error.message });
  }
};

// Middleware to Verify admin or outlet user
const verifyAdminOutlets = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(403).json({ error: "User not found in Firestore" });

    const userData = userDoc.data();
    if (userData.role !== "S000admin01" && userData.role !== "OutManager001" && userData.role !== "S000admin01admin" && userData.role !== "OutManager001Man"  ) return res.status(403).json({ error: "Forbidden: Not an admin or outlet user" });

    req.user = {userData,userId}; 
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token", details: error.message });
  }
};

// Middleware to Verify outlet user
const verifySuperOutlets = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(403).json({ error: "User not found in Firestore" });

    const userData = userDoc.data();
    if (  userData.role !== "OutManager001Man"  ) return res.status(403).json({ error: "Forbidden: Not an outlet user" });

    req.user = userData; 
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token", details: error.message });
  }
};

// Middleware to Verify outlet user
const verifySuperAdminOutlets = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(403).json({ error: "User not found in Firestore" });

    const userData = userDoc.data();
    if (  userData.role !== "OutManager001Man" && userData.role !== "S000admin01admin"  && userData.role !== "S000admin01"  ) return res.status(403).json({ error: "Forbidden: Not an outlet user" });

    req.user = userData; 
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token", details: error.message });
  }
};

// Middleware to Verify outlet user
const verifyOutlets = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(403).json({ error: "User not found in Firestore" });

    const userData = userDoc.data();
    if ( userData.role !== "OutManager001" &&  userData.role !== "OutManager001Man"  ) return res.status(403).json({ error: "Forbidden: Not an outlet user" });

    req.user = userData; 
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token", details: error.message });
  }
};

// Middleware to Verify outlet user
const verifyCurrentUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token
    userid = req.params.id
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await db.collection("users").doc(userId).get();

    
    if (!userDoc.exists) return res.status(403).json({ error: "User not found in Firestore" });
    const userData = userDoc.data();
    if (userid !== req.params.id && userData.email !== req.params.id && userData.PhoneNumber !== req.params.id  ) return res.status(403).json({ error:  "You don't have permission to update" });

    req.user = {userData,userId}; 
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token", details: error.message });
  }
};

// Middleware to Verify admin
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token
    if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

    const decodedToken = await admin.auth().verifyIdToken(token);
    const userId = decodedToken.uid;

    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) return res.status(403).json({ error: "User not found in Firestore" });

    req.user = userData; 
    next();
  } catch (error) {
    res.status(403).json({ error: "Invalid or expired token", details: error.message });
  }
};

module.exports = { verifyAdmin, db,verifyToken ,verifyCurrentUser,verifyAdminOutlets,verifyOutlets,verifySuperAdmin,verifySuperOutlets,verifySuperAdminOutlets};

const outletRoutes = require("./outletRoutes");
const districtRoutes = require("./districtRoutes");
const deliveryScheduleRoutes = require("./deliveryScheduleRoutes");
const cylinderRoutes = require("./cylinderRoutes");
const userRoutes = require("./userRoutes");
const gasRequestRoutes = require("./gasRequestRoutes");
const notificationRoutes = require("./notificationRoutes");
const deliveryNotificationRunner = require("./deliveryNotificationRunner");
app.use("/api", userRoutes);
app.use(outletRoutes);
app.use(districtRoutes);
app.use(cylinderRoutes);
app.use(deliveryScheduleRoutes);
app.use(gasRequestRoutes);
app.use(notificationRoutes);
// deliveryNotificationRunner.checkAndSendNotifications();

app.post('/api/login', async (req, res) => {

  const token = req.headers.authorization?.split(" ")[1]; // Extract Bearer Token
  if (!token) return res.status(401).json({ error: "Unauthorized: No token provided" });

  const decodedToken = await admin.auth().verifyIdToken(token);
  const userId = decodedToken.uid;

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) return res.status(403).json({ error: "User not found in Firestore" });

  const userData = userDoc.data();
  return res.json({
    message: "Login successful",
    user: userData,  // Return Firestore data instead of just decoded token
  });
  
});




// Create a new driver
app.post("/api/drivers", verifyAdmin, async (req, res) => {
  try {
    const { DriverName, LicenceNumber, PhoneNumber, Address, Status } = req.body;
    
  const snapshot = await driversCollection.get();
  const existingDrivers = snapshot.docs.map(doc => doc.data());

  const existingDriverByLicence = existingDrivers.find(driver => driver.LicenceNumber === LicenceNumber);
  if (existingDriverByLicence) {
    return res.status(400).json({ error: "LicenceNumber must be unique" });
  }

  const existingDriverByPhone = existingDrivers.find(driver => driver.PhoneNumber === PhoneNumber);
  if (existingDriverByPhone) {
    return res.status(400).json({ error: "PhoneNumber must be unique" });
  }


    const newDriverRef = await driversCollection.add({
      DriverName,
      LicenceNumber,
      PhoneNumber,
      Address,
      Status,
    });

    res.status(201).json({ DriverID: newDriverRef.id, message: "Driver added successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update driver by DriverID
app.put("/api/drivers/:DriverID", verifyAdmin, async (req, res) => {
  try {
    const { DriverID } = req.params;
    const driverRef = driversCollection.doc(DriverID);
    const driverDoc = await driverRef.get();

    // Check if driver exists
    if (!driverDoc.exists) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const driverData = driverDoc.data();
    const restrictedStatuses = ["Scheduled", "Driving"];

    if (restrictedStatuses.includes(driverData.Status)) {
      return res.status(400).json({ message: "You can't update this driver!" });
    }

    await driverRef.update(req.body);
    res.json({ message: "Driver updated successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver by DriverID
app.get("/api/drivers/:DriverID", verifyAdminOutlets, async (req, res) => {
  try {
    const { DriverID } = req.params;
    const driverRef = driversCollection.doc(DriverID);
    const driverDoc = await driverRef.get();

    if (!driverDoc.exists) {
      return res.status(404).json({ error: "Driver not found" });
    }

    res.json({ DriverID: driverDoc.id, ...driverDoc.data() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get driver details by Phone Number
app.get("/api/drivers/byPhoneNumber/:PhoneNumber",verifyAdminOutlets, async (req, res) => {
  try {
    const { PhoneNumber } = req.params;

    const querySnapshot = await driversCollection.where("PhoneNumber", "==", PhoneNumber).get();

    if (querySnapshot.empty) {
      return res.status(404).json({ error: "Driver not found" });
    }

    const driverDoc = querySnapshot.docs[0];
    const driverData = driverDoc.data();

    res.json({ DriverID: driverDoc.id, ...driverData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all drivers
app.get("/api/drivers", verifyAdminOutlets, async (req, res) => {
  try {
    const snapshot = await driversCollection.get();
    const drivers = snapshot.docs.map((doc) => ({
      DriverID: doc.id,
      ...doc.data(),
    }));

    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the app
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`app running on port ${PORT}`);
});

// // Start the server
// const PORT2 = process.env.PORT || 4000;
// server.listen(PORT2, () => {
//   console.log(`Server running on port ${PORT2}`);
// });

