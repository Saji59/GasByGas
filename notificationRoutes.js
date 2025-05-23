const express = require("express");
const router = express.Router();
const { sendSMS, sendEmail } = require("./clicksendService");

// API Route to send SMS
router.post("/api/accountcreation/sendsms", async (req, res) => {
  console.log("api Call");
    const { phone, message } = req.body;
  console.log(message);

  if (!phone || !message) {
    return res.status(400).json({ error: "Phone number and message are required!" });
  }

  try {
    const response = await sendSMS(phone, message);
    res.status(200).json({ success: true, response });
  } catch (error) {
    res.status(500).json({ error: "Failed to send SMS" });
    console.log(error.message);
  }
});

// API Route to send Email
router.post("api/send-email", async (req, res) => {
  const { email, subject, body } = req.body;

  if (!email || !subject || !body) {
    return res.status(400).json({ error: "Email, subject, and body are required!" });
  }

  try {
    const response = await sendEmail(email, subject, body);
    res.status(200).json({ success: true, response });
  } catch (error) {
    res.status(500).json({ error: "Failed to send Email" });
  }
});

module.exports = router;
