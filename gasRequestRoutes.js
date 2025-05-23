
const express = require("express");
const moment = require("moment");
const admin = require("firebase-admin");
const { verifyAdmin,verifyToken,verifyAdminOutlets, verifyOutlets } = require("./index");

const router = express.Router();
const db = admin.firestore();

const { v4: uuidv4 } = require('uuid');

const formatDate = (timestamp) => {
    if (timestamp) {
        try {
            const date = new Date(timestamp._seconds * 1000); // Convert seconds to milliseconds
            const returndate =  new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false
            }).format(date);
            return returndate;
        } catch (error) {
            console.error("Error formatting date:", error); // Log any date formatting errors
            return null; // Return null if the date is invalid
        }
    }
    else
     return null;
}


// Create Gas Request
router.post('/api/gasrequests', async (req, res) => {
    try {
        const {
            UserID,
            OutletID,
            CylinderID,
            CylinderCount,
            CylinderType
        } = req.body;

        const TokenNumber = uuidv4();
        const RequestDate = new Date();
        const TokenExpiryDate = new Date(RequestDate);
        TokenExpiryDate.setDate(TokenExpiryDate.getDate() + 14);
        const newRequest = {
            RequestID: uuidv4(),
            UserID,
            OutletID : parseInt(OutletID,10),
            RequestDate,
            CylinderID,
            CylinderCount,
            Status: 'Requested',
            TokenNumber,
            TokenExpiryDate,
            CylinderType,
            SalesID: null,
            RecivedDate: null
        };

        await db.collection('gasrequests').add(newRequest);

        res.status(201).json({ message: 'Request created successfully', data: newRequest });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Gas Request
router.put('/api/gasrequests/:id', verifyAdminOutlets, async (req, res) => {
    try {
        const { id } = req.params;
        //console.log(req.params);
        const { Status, TokenExpiryDate, SalesID, RecivedDate, UserID, PaymentMethod, Price, ReferenceNo, OutletID } = req.body;


        const requestRef = db.collection('gasrequests').doc(id);
        const requestDoc = await requestRef.get();

        if (!requestDoc.exists) {
            return res.status(404).json({ message: 'Request not found' });
        }

        let updatedData = {};
        if (Status) {
            updatedData.Status = Status;


            if (Status.toLowerCase() === 'completed') {

                if (!Price || !PaymentMethod || !OutletID) {
                    return res.status(400).json({ message: 'Price, PaymentMethod, and OutletID are required for completed status' });
                }

                const onlinePayments = ["Online Banking", "EZ Cash"];
                if (onlinePayments.includes(PaymentMethod) && !ReferenceNo) {
                    return res.status(400).json({ message: 'ReferenceNo is required for online payments' });
                }

                const now = new Date();
                const dbnow = admin.firestore.Timestamp.now();
                updatedData.RecivedDate =dbnow;
                const formattedDate = `${now.getDate().toString().padStart(2, '0')}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getFullYear()}${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
                const newSalesID = `${formattedDate}_${OutletID}`;

                // Save sales data
                const salesData = {
                    SalesID: newSalesID,
                    GasRequestID: id,
                    PaidAmount: Price,
                    PaymentMethod,
                    ReferenceNo: ReferenceNo || "", // Store ReferenceNo only if provided
                    UserID : req.user.userId,
                    CreatedAt: dbnow
                };

                await db.collection('sales').doc(newSalesID).set(salesData);

                updatedData.SalesID = newSalesID;
            }

        }
        if (TokenExpiryDate) {
            const parts = TokenExpiryDate.split(", ");
            const dateParts = parts[0].split("/"); // Split "DD/MM/YYYY"
            const timeParts = parts[1].split(":"); // Split "HH:mm"

            const day = parseInt(dateParts[0], 10);
            const month = parseInt(dateParts[1], 10) - 1; // Months are 0-based in JS
            const year = parseInt(dateParts[2], 10);
            const hours = parseInt(timeParts[0], 10);
            const minutes = parseInt(timeParts[1], 10);

            const expiryDate = new Date(year, month, day, hours, minutes);

            if (isNaN(expiryDate.getTime())) {
                return res.status(400).json({ message: "Invalid TokenExpiryDate format" });
            }

            updatedData.TokenExpiryDate = admin.firestore.Timestamp.fromDate(expiryDate);
        }
        //if (TokenExpiryDate) updatedData.TokenExpiryDate = new Date(TokenExpiryDate);
        //if (RecivedDate) updatedData.RecivedDate = new Date(RecivedDate);
        // console.log(updatedData);

        await requestRef.update(updatedData);

        res.json({ message: 'Request updated successfully', data: updatedData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// Get All Gas Request
router.get("/api/gasrequests", async (req, res) => {
    try {
      const gasRequestsSnapshot = await db.collection("gasrequests").get();

      if (gasRequestsSnapshot.empty) {
        return res.status(404).send({ message: "No gas requests found" });
      }

      // Map over the snapshot data
      const gasRequests = gasRequestsSnapshot.docs.map(doc => {
        const data = doc.data();

        return {
          id: doc.id,
          CylinderCount: data.CylinderCount,
          CylinderType:data.CylinderType,
          OutletID:parseInt(data.OutletID,10),
          RecivedDate: formatDate(data.RecivedDate),
          RequestDate: formatDate(data.RequestDate),
          TokenExpiryDate: (data.TokenExpiryDate),
          UserID:data.UserID,
          Status:data.Status,
          CylinderID:data.CylinderID,
          SalesID:data.SalesID
        };
      });

      res.status(200).send(gasRequests);
    } catch (error) {
      res.status(500).send({ message: "Error retrieving gas requests", error: error.message });
    }
  });


// Get Gas Request by ID
router.get('/api/gasrequests/:id', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const requestRef = db.collection('gasrequests').doc(id);
        const requestDoc = await requestRef.get();

        if (req.user.id === requestDoc.data().UserID) {
            return res.status(404).json({ message: 'Sorry, You don\'t have access.' });
        }

        if (!requestDoc.exists) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const data = requestDoc.data();
        res.json({
            data: {
                id: doc.id,
                CylinderCount: data.CylinderCount,
                CylinderType:data.CylinderType,
                OutletID:parseInt(data.OutletID,10),
                RecivedDate: formatDate(data.RecivedDate),
                RequestDate: formatDate(data.RequestDate),
                TokenExpiryDate: formatDate(data.TokenExpiryDate),
                UserID:data.UserID,
                Status:data.Status,
                CylinderID:data.CylinderID,
                SalesID:data.SalesID
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Gas Requests by Outlet ID
router.get('/api/gasrequests/outlet/:outletId', verifyOutlets, async (req, res) => {
    try {
        const { outletId } = req.params;
        const requestSnapshot = await db.collection('gasrequests')
            .where('OutletID', '==', parseInt(outletId,10))
            .get();

        if (requestSnapshot.empty) {
            return res.status(404).json({ message: 'No requests found for this outlet' });
        }

        const requests = requestSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
          CylinderCount: data.CylinderCount,
          CylinderType:data.CylinderType,
          OutletID:parseInt(data.OutletID,10),
          RecivedDate: formatDate(data.RecivedDate),
          RequestDate: formatDate(data.RequestDate),
          TokenExpiryDate: formatDate(data.TokenExpiryDate),
          UserID:data.UserID,
          Status:data.Status,
          CylinderID:data.CylinderID,
          SalesID:data.SalesID
            };
        });

        res.json({ data: requests });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Gas Requests by User ID
router.get('/api/gasrequests/user/:userId', verifyToken, async (req, res) => {
    try {
        const { userId } = req.params;

        if (req.user.id === userId) {
            return res.status(404).json({ message: 'Sorry, You don\'t have access.' });
        }

        const requestSnapshot = await db.collection('gasrequests')
            .where('UserID', '==', userId)
            .get();

        if (requestSnapshot.empty) {
            return res.status(404).json({ message: 'No requests found for this user' });
        }

        const requests = requestSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
          CylinderCount: data.CylinderCount,
          CylinderType:data.CylinderType,
          OutletID:parseInt(data.OutletID,10),
          RecivedDate: formatDate(data.RecivedDate),
          RequestDate: formatDate(data.RequestDate),
          TokenExpiryDate: formatDate(data.TokenExpiryDate),
          UserID:data.UserID,
          Status:data.Status,
          CylinderID:data.CylinderID,
          SalesID:data.SalesID
            };
        });

        res.json({ data: requests });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Gas Requests by Status
router.get('/api/gasrequests/status/:status', verifyAdminOutlets, async (req, res) => {
    try {
        const { status } = req.params;
        const requestSnapshot = await db.collection('gasrequests')
            .where('Status', '==', status)
            .get();



        if (requestSnapshot.empty) {

            return res.status(404).json({ message: `No requests found with status: ${status}` });
        }



        const requests = requestSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                CylinderCount: data.CylinderCount,
                CylinderType:data.CylinderType,
                OutletID:parseInt(data.OutletID,10),
                RecivedDate: formatDate(data.RecivedDate),
                RequestDate: formatDate(data.RequestDate),
                TokenExpiryDate: formatDate(data.TokenExpiryDate),
                UserID:data.UserID,
                Status:data.Status,
                CylinderID:data.CylinderID,
                SalesID:data.SalesID
              };
        });

        res.json({ data: requests });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Gas Requests by Token Number (QR scanning)
router.get('/api/gasrequests/token/:tokenNumber',verifyOutlets,  async (req, res) => {
    try {
        const { tokenNumber } = req.params;

        const requestSnapshot = await db.collection('gasrequests')
            .where('TokenNumber', '==', tokenNumber)
            .get();

        if (requestSnapshot.empty) {
            return res.status(404).json({ message: 'Request not found for the given token number' });
        }

        const tokendata = requestSnapshot.docs[0].data();

        const userSnapshot = await db.collection('users')
            .doc(tokendata.UserID)
            .get();

        if (!userSnapshot.exists) {
            return res.status(404).json({ message: 'User not found' });
        }
        const userData = userSnapshot.data();
        const userName = userData.name;

        const priceSnapshot = await db.collection('Pricelist')
           .where('CylinderID', '==', tokendata.CylinderID)
            .get();

        if (priceSnapshot.empty) {
            return res.status(404).json({ message: 'Price list not found for the given CylinderID' });
        }

        const priceData = priceSnapshot.docs[0].data();
        let price = 0;

        if (tokendata.CylinderType === 'Refill') {
            price = parseFloat(priceData.RefillPrice) * tokendata.CylinderCount;
        } else {
            price = parseFloat(priceData.NewCylinderprice) * tokendata.CylinderCount;
        }

        const formattedPrice = price.toFixed(2).toString();

        res.json({
            data: {
                id: requestSnapshot.docs[0].id,
                CylinderCount: tokendata.CylinderCount,
                CylinderType: tokendata.CylinderType,
                OutletID: parseInt(tokendata.OutletID,10),
                RequestDate: formatDate(tokendata.RequestDate),
                RecivedDate: formatDate(tokendata.RecivedDate),
                TokenExpiryDate: formatDate(tokendata.TokenExpiryDate),
                UserID: tokendata.UserID,
                UserName: userName,
                Status: tokendata.Status,
                CylinderID: tokendata.CylinderID,
                SalesID: tokendata.SalesID,
                Price: formattedPrice
            }
        });
    } catch (error) {
        console.error("Error fetching gas request:", error);
        res.status(500).json({ error: error.message });
    }
});




// Get Expiring Gas Requests (Near Token Expiry)
router.get('/api/gasrequests/expiring', verifyAdminOutlets, async (req, res) => {
    try {
        const currentDate = new Date();
        const expiryThreshold = new Date();
        expiryThreshold.setDate(expiryThreshold.getDate() + 2);

        const requestSnapshot = await db.collection('gasrequests')
            .where('TokenExpiryDate', '<=', expiryThreshold)
            .get();

        if (requestSnapshot.empty) {
            return res.status(404).json({ message: 'No expiring requests found' });
        }

        const requests = requestSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                CylinderCount: data.CylinderCount,
                CylinderType:data.CylinderType,
                OutletID:parseInt(data.OutletID,10),
                RecivedDate: formatDate(data.RecivedDate),
                RequestDate: formatDate(data.RequestDate),
                TokenExpiryDate: formatDate(data.TokenExpiryDate),
                UserID:data.UserID,
                Status:data.Status,
                CylinderID:data.CylinderID,
                SalesID:data.SalesID

            };
        });

        res.json({ data: requests });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



router.get("/api/latestgasrequests",verifyAdminOutlets, async (req, res) => {
    try {
        if(req.user.userData.role == "OutManager001" || req.user.role == "OutManager001Man")
        {
            const OutletID = parseInt(req.user.userData.outletID,10);
            const gasRequestsSnapshot = await db
            .collection("gasrequests")
            .where("OutletID", "==", OutletID)
            .orderBy("RequestDate", "desc" ,"OutletID", "asc")
            .limit(5)
            .get();

        if (gasRequestsSnapshot.empty) {

            return res.status(404).send({ message: "No gas requests found" });
        }

        const gasRequests = await Promise.all(gasRequestsSnapshot.docs.map(async (doc) => {
            const data = doc.data();

            let userName = "Unknown User";

            if (data.UserID) {
                const userDoc = await db.collection("users").doc(data.UserID).get();
                if (userDoc.exists) {
                    userName = userDoc.data().name;
                }
            }
            let OutletName = "Unknown Outlet";
            if (data.OutletID) {

                const stringOuteltID = data.OutletID.toString();
                const outletSnapshot = await db.collection("Outlets").doc(stringOuteltID).get();

                if (outletSnapshot.exists) {
                       OutletName = outletSnapshot.data().OutletName;
                    
                }

               
            }

            // Fetch Cylinder Capacity
            let cylinderCapacity = "Unknown Capacity";
            if (data.CylinderID) {
                const cylinderDoc = await db.collection("Cylinders").doc(String(data.CylinderID)).get();
                if (cylinderDoc.exists) {
                    cylinderCapacity = cylinderDoc.data().Capacity;
                }
            }

            return {
                id: doc.id,
                CylinderCount: data.CylinderCount || 0,
                CylinderType: data.CylinderType || "Unknown",
                OutletName: OutletName,
                RecivedDate: data.RecivedDate ? data.RecivedDate.toDate().toISOString() : null,
                RequestDate: data.RequestDate ? data.RequestDate.toDate().toISOString() : null,
                TokenExpiryDate: data.TokenExpiryDate ? data.TokenExpiryDate.toDate().toISOString() : null,
                UserName: userName,
                Status: data.Status === "Requested" ? "Pending" : data.Status || "Pending",
                CylinderID: data.CylinderID || 0,
                Capacity: cylinderCapacity,
                SalesID: data.SalesID || null
            };
        }));
        res.status(200).send(gasRequests);
        }
        else
        {
            const gasRequestsSnapshot = await db
        .collection("gasrequests")
        .orderBy("RequestDate", "desc")
        .limit(5)
        .get();




        if (gasRequestsSnapshot.empty) {
            return res.status(404).send({ message: "No gas requests found" });
        }
        const gasRequests = await Promise.all(gasRequestsSnapshot.docs.map(async (doc) => {
            const data = doc.data();

            let userName = "Unknown User";
            if (data.UserID) {
                const userDoc = await db.collection("users").doc(data.UserID).get();
                if (userDoc.exists) {
                    userName = userDoc.data().name;
                }
            }

            let OutletName = "Unknown Outlet";
            if (data.OutletID) {
                const stringOuteltID = data.OutletID.toString();
                const outletDoc = await db.collection("Outlets").doc(stringOuteltID).get();

                if (outletDoc.exists) {

                    OutletName = outletDoc.data().OutletName;
                }
            }

            // Fetch Cylinder Capacity
            let cylinderCapacity = "Unknown Capacity";
            if (data.CylinderID) {
                const cylinderDoc = await db.collection("Cylinders").doc(String(data.CylinderID)).get();
                if (cylinderDoc.exists) {
                    cylinderCapacity = cylinderDoc.data().Capacity;
                }
            }

            return {
                id: doc.id,
                CylinderCount: data.CylinderCount || 0,
                CylinderType: data.CylinderType || "Unknown",
                OutletName: OutletName,
                RecivedDate: data.RecivedDate ? data.RecivedDate.toDate().toISOString() : null,
                RequestDate: data.RequestDate ? data.RequestDate.toDate().toISOString() : null,
                TokenExpiryDate: data.TokenExpiryDate ? data.TokenExpiryDate.toDate().toISOString() : null,
                UserName: userName,
                Status: data.Status === "Requested" ? "Pending" : data.Status || "Pending",
                CylinderID: data.CylinderID || 0,
                Capacity: cylinderCapacity,
                SalesID: data.SalesID || null
            };
        }));
        res.status(200).send(gasRequests);
        }



    } catch (error) {
        res.status(500).send({ message: "Error retrieving gas requests", error: error.message });
    }
});

// router.get("/api/latestgasrequests/:outletID",verifyOutlets, async (req, res) => {
//     try {
//         const { OutletID } = req.params;
//         const gasRequestsSnapshot = await db
//             .collection("gasrequests")
//             .orderBy("RequestDate", "desc")
//             .where(x=>x.OutletID === OutletID)
//             .limit(5)
//             .get();


//         if (gasRequestsSnapshot.empty) {
//             return res.status(404).send({ message: "No gas requests found" });
//         }
//         const gasRequests = await Promise.all(gasRequestsSnapshot.docs.map(async (doc) => {
//             const data = doc.data();

//             let userName = "Unknown User";
//             if (data.UserID) {
//                 const userDoc = await db.collection("users").doc(data.UserID).get();
//                 if (userDoc.exists) {
//                     userName = userDoc.data().name;
//                 }
//             }

//             let OutletName = "Unknown Outlet";
//             if (data.OutletID) {
//                 const outletDoc = await db.collection("Outlets").doc(data.OutletID).get();

//                 if (outletDoc.exists) {

//                     OutletName = outletDoc.data().OutletName;
//                 }
//             }

//             // Fetch Cylinder Capacity
//             let cylinderCapacity = "Unknown Capacity";
//             if (data.CylinderID) {
//                 const cylinderDoc = await db.collection("Cylinders").doc(String(data.CylinderID)).get();
//                 if (cylinderDoc.exists) {
//                     cylinderCapacity = cylinderDoc.data().Capacity;
//                 }
//             }

//             return {
//                 id: doc.id,
//                 CylinderCount: data.CylinderCount || 0,
//                 CylinderType: data.CylinderType || "Unknown",
//                 OutletName: OutletName,
//                 RecivedDate: data.RecivedDate ? data.RecivedDate.toDate().toISOString() : null,
//                 RequestDate: data.RequestDate ? data.RequestDate.toDate().toISOString() : null,
//                 TokenExpiryDate: data.TokenExpiryDate ? data.TokenExpiryDate.toDate().toISOString() : null,
//                 UserName: userName,
//                 Status: data.Status === "Requested" ? "Pending" : data.Status || "Pending",
//                 CylinderID: data.CylinderID || 0,
//                 Capacity: cylinderCapacity,
//                 SalesID: data.SalesID || null
//             };
//         }));

//         res.status(200).send(gasRequests);
//     } catch (error) {
//         console.log(error);
//         res.status(500).send({ message: "Error retrieving gas requests", error: error.message });
//     }
// });

// API to check cylinder availability
router.post('/api/checkavailability', async (req, res) => {
    const { OutletID, CylinderID, Quantity } = req.body;



    try {




        const cylinderIDStr = CylinderID.toString();
        const quantityStr = Quantity.toString();
      //  Get the total quantity from deliverySchedules table
      let totalDeliveryQuantity = 0;
      const deliverySchedulesSnapshot = await db.collection('deliverySchedules')
        .where('OutletID', '==', parseInt(OutletID,10))
        .where('Status','in', ['Shipped', 'Delivered'])
        .get();



      deliverySchedulesSnapshot.forEach(doc => {
        const data = doc.data();
        if (CylinderID === 1) totalDeliveryQuantity += parseInt(data.Kg2_3LPGasQuantity,10) || 0;
        if (CylinderID === 2) totalDeliveryQuantity += parseInt(data.Kg5LPGasQuantity,10) || 0;
        if (CylinderID === 3) totalDeliveryQuantity += parseInt(data.Kg12_5LPGasQuantity,10) || 0;
        if (CylinderID === 4) totalDeliveryQuantity += parseInt(data.Kg37_5LPGasQuantity,10) || 0;
        if (CylinderID === 5) totalDeliveryQuantity += parseInt(data.Kg47_5LPGasQuantity,10) || 0;
      });
     // console.log("totalDeliveryQuantity "+ totalDeliveryQuantity );
      // Get the total CylinderCount from gasrequests table

      let totalGasRequests = 0;
      const gasRequestsSnapshot = await db.collection('gasrequests')
        .where('OutletID', '==', parseInt(OutletID,10))
        .where('CylinderID', '==', CylinderID)
        .where('Status', 'in', ['Completed','Notified', 'Requested'])
        .get();
        // console.log("gasRequestsSnapshot " + gasRequestsSnapshot );

      gasRequestsSnapshot.forEach(doc => {
        const data = doc.data();
        totalGasRequests += parseInt(data.CylinderCount,10) || 0;
      });

    //   console.log("totalGasRequests " + totalGasRequests );

      const balanceCylinder = totalDeliveryQuantity - totalGasRequests;
    //   console.log(balanceCylinder);
      if (balanceCylinder >= Quantity) {
        res.status(200).json({ message: 'Cylinder Available' });
      } else {
        res.status(404).json({ message: 'No Cylinder Available' });
      }

    } catch (error) {
      console.error('Error checking cylinder availability:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });



router.post('/api/checkCylinderavailability', async (req, res) => {
    const { UserID, CylinderID } = req.body;

    try {

        let totalGasRequests = 0;
        const gasRequestsSnapshot = await db.collection('gasrequests')
            .where('UserID', '==', UserID)
            .where('CylinderID', '==', CylinderID)
            .where('Status', 'in', ['Notified', 'Requested'])
            .get();

        gasRequestsSnapshot.forEach(doc => {
            const data = doc.data();
            totalGasRequests += parseInt(data.CylinderCount, 10) || 0;
        });


        // Maximum allowed per user is 5
        const maxAllowed = 5;
        const availableQuantity = maxAllowed - totalGasRequests;

        if (availableQuantity <= 0) {
            return res.status(200).json({ availableQuantity: 0, message: 'Your limit is finished.' });
        } else {
            return res.status(200).json({ availableQuantity, message: 'Cylinders available.' });
        }
    } catch (error) {
        console.error('Error checking cylinder availability:', error);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
});

router.post('/api/getGasRequestByFilter', async (req, res) => {
    const {  status, cylinderType, refillType,userid} = req.body;
    try {
    

      let query = db.collection('gasrequests')
        // .where('RequestDate', '>=', filterFromDate)
        // .where('RequestDate', '<=', filterToDate)
        .where('UserID', '<=', userid);

      if (refillType && refillType !== 'All') {
        query = query.where('CylinderType', '==', refillType);
      }

      if (status && status !== 'All') {
        query = query.where('Status', '==', status);
      }

      if (cylinderType && cylinderType !== 'All') {
        query = query.where('CylinderID', '==', parseInt(cylinderType,10));
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        console.log('No records found' );
        return res.status(404).json({ message: 'No records found' });
      }

      const gasRequests = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data
        };
      });

      res.status(200).json(gasRequests);

    } catch (error) {
        console.log(error.message);
      console.error('Error fetching gas request history:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });


module.exports = router;
