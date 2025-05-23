const axios = require("axios");

const CLICK_SEND_USERNAME = "mrm.arfath1";
const CLICK_SEND_API_KEY = "B1330268-B755-9C54-362C-2DA7E52C9DD1";

//  Function to send SMS
const sendSMS = async (to, message) => {
  try {
    const response = await axios.post(
      "https://rest.clicksend.com/v3/sms/send",
      {
        messages: [
          {
            from: "GasByGas",
            to: to,
            body: message,
          },
        ],
      },
      {
        auth: {
          username: CLICK_SEND_USERNAME,
          password: CLICK_SEND_API_KEY,
        },
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("SMS Sent:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending SMS:", error.response?.data || error.message);
    console.log("SMS Sent:", error.message);
    throw error;
  }
};

const sendEmail = async (to, subject, body) => {
  try {
    const response = await axios.post(
      "https://rest.clicksend.com/v3/email/send",
      {
        to: to,
        subject: subject,
        body: body,
        from_email: "gasbygas@gmail.com",
        from_name: "GasByGas Support",
      },
      {
        auth: {
          username: CLICK_SEND_USERNAME,
          password: CLICK_SEND_API_KEY,
        },
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("Email Sent:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error sending Email:", error.response?.data || error.message);
    throw error;
  }
};


module.exports = { sendSMS, sendEmail };
