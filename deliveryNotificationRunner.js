const express = require("express");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const cron = require('node-cron'); 

const router = express.Router();
const db = admin.firestore();

const { sendSMS, sendEmail } = require("./clicksendService");


// Function to check and send notifications
const checkAndSendNotifications = async () => {
  try {
    const deliverySchedulesSnapshot = await db
      .collection('deliverySchedules')
      .where('Status', '==', 'Shipped')
      .where('ExpectedDeliveryDate', '>', new Date(Date.now() - 24 * 60 * 60 * 1000)) // Expected delivery date > 1 day ago
      .get();

    if (deliverySchedulesSnapshot.empty) {
      console.log('No delivery schedules found.');
      return;
    }

    const notificationUsers = [];

    for (const deliveryDoc of deliverySchedulesSnapshot.docs) {
      const deliveryData = deliveryDoc.data();
      const outletID = parseInt(deliveryData.OutletID,10);
      const scheduleID = deliveryData.ScheduleID;

      const deliveryNotificationSnapshot = await db
        .collection('deliveryNotification')
        .where('ScheduleID', '==', scheduleID)
        .get();

      if (!deliveryNotificationSnapshot.empty) {
        console.log(`ScheduleID ${scheduleID} already notified.`);
        continue;
      }

     
      const gasRequestsSnapshot = await db
        .collection('gasrequests')
        .where('Status', '==', 'Requested')
        .where('OutletID', '==', parseInt(OutletID,10))
        .where('TokenExpiryDate' ,'>' , new Date(Date.now() ))
        .orderBy('RequestedDate') 
        .get();

      let cylindersAvailable = {
        cylinder1: deliveryData.Kg2_3LPGasQuantity,
        cylinder2: deliveryData.Kg47_5LPGasQuantity,
        cylinder2: deliveryData.Kg12_5LPGasQuantity,
        cylinder4: deliveryData.Kg37_5LPGasQuantity,
        cylinder5: deliveryData.Kg5LPGasQuantity
      };

      for (const requestDoc of gasRequestsSnapshot.docs) {
        const requestData = requestDoc.data();
        const requiredCylinderID = requestData.CylinderID;
        const requiredQty = requestData.CylinderCount;

        if (cylindersAvailable[`cylinder${requiredCylinderID}`] >= requiredQty) {
          notificationUsers.push({
            userID: requestData.UserID,
            outletID: parseInt(outletID,10),
            cylinderID: requiredCylinderID,
            quantity: requiredQty
          });

          cylindersAvailable[`cylinder${requiredCylinderID}`] -= requiredQty;
        }

        if (cylindersAvailable[`cylinder${requiredCylinderID}`] <= 0) break;
      }
    }

    if (notificationUsers.length > 0) {
      console.log(`Sending notifications to ${notificationUsers.length} users.`);
      sendNotifications(notificationUsers); 
    } else {
      console.log('No users to notify.');
    }

  } catch (error) {
    console.error('Error checking schedules and sending notifications:', error);
  }
};

const sendNotifications =  (notificationUsers) => {
  notificationUsers.forEach(async (user) => {
    const userRef = db.collection("users").doc(user.userID);
    const userDoc = await userRef.get();
    const messaging = "Your Requested Cylinder is arrived in onday please visit the outlet within the token expired period";
    sendEmail(userDoc.data().email,"Delivery Notification",messaging)
    sendSMS(userDoc.data().phoneNumber,messaging)
    console.log(`Sending notification to UserID: ${user.userID} for CylinderID: ${user.cylinderID} with Quantity: ${user.quantity}`);
  });
};

cron.schedule('0 * * * *', () => {
  console.log('Running task to check delivery schedules and send notifications...');
  checkAndSendNotifications(); // Call the function to check and send notifications
});

module.exports = { checkAndSendNotifications, router };
