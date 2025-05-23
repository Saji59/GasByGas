const express = require("express");
const admin = require("firebase-admin");
const { verifyAdmin, verifyAdminOutlets,verifyCurrentUser } = require("./index"); 
const nodemailer = require("nodemailer");

const router = express.Router();
const db = admin.firestore();

const validateFields = (fields, body) => {
  return fields.every((field) => body[field]);
};
const e164PhoneRegex = /^\+?[1-9]\d{1,14}$/;

const formatPhoneNumber = (phoneNumber) => {
  const cleanedPhoneNumber = phoneNumber.replace(/\D/g, '');

  if (cleanedPhoneNumber.startsWith('94') && cleanedPhoneNumber.length === 11) {
    return `+${cleanedPhoneNumber}`;
  }

  if (cleanedPhoneNumber.length === 10 && cleanedPhoneNumber.startsWith('0')) {
    return `+94${cleanedPhoneNumber.slice(1)}`;
  }

  if (cleanedPhoneNumber.length === 9) {
    return `+94${cleanedPhoneNumber}`;
  }

  throw new Error("Invalid phone number format. It should be a valid Sri Lankan phone number.");
};

// Create a Main Branch User
router.post("/main-branch/register", verifyAdmin, async (req, res) => {
  try {
    const { name, email, phoneNumber, status, password } = req.body;

    if (!validateFields(["name", "email", "phoneNumber", "status", "password"], req.body)) {
      return res.status(400).send({ message: "Missing required fields" });
    }
    if (!e164PhoneRegex.test(phoneNumber)) {
        return res.status(400).send('Invalid phone number format. It must follow E.164 standard. eg:+123456789101');
      }

    const role = "S000admin01";

    const userRecord = await admin.auth().createUser({
      email,
      phoneNumber,
      password,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    await db.collection("users").doc(userRecord.uid).set({
      name,
      email,
      phoneNumber,
      role,
      status,
      createdDate: new Date(),
      branchID: 1,
    });

    res.status(201).send({ message: "Main Branch User created", userId: userRecord.uid });
  } catch (error) {
    //console.log(error);
    res.status(500).send({ message:error.message|| "Error creating user", error: error });
  }
});

// Create an Outlet User
router.post("/outlet/register", verifyAdmin, async (req, res) => {
  try {
    const { name, email, phoneNumber, status, password, method, outletID, createdBy } = req.body;

    if (!validateFields(["name", "email", "phoneNumber", "status", "password", "method", "outletID", "createdBy"], req.body)) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    const role = "OutManager001";

    const userRecord = await admin.auth().createUser({
      email,
      phoneNumber,
      password,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role });

    await db.collection("users").doc(userRecord.uid).set({
      name,
      email,
      phoneNumber,
      role,
      status,
      createdDate: new Date(),
      outletID,
      createdBy,
    });

    res.status(201).send({ message: "Outlet User created", userId: userRecord.uid });
  } catch (error) {
    res.status(500).send({ message: "Error creating user", error: error.message });
  }
});

// Create a Customer (Individual or Organization)
router.post("/customer/register", async (req, res) => {
  try {
    const { name, email, phoneNumber, status, password, method, customerType, organizationCertification } = req.body;
    if (!validateFields(["name", "email", "phoneNumber", "status", "password", "method", "customerType"], req.body)) {
      return res.status(400).send({ message: "Missing required fields" });
    }

    let role = "cus0001";
    if (customerType === "Organization") {
      role = "cus0001Org";
    }
    
    const updatephonenumber = formatPhoneNumber(phoneNumber);
    const userRecord = await admin.auth().createUser({
      email,
      updatephonenumber,
      password,
      displayName: name,
      emailVerified: false,
      disabled: false,
    });

    await admin.auth().setCustomUserClaims(userRecord.uid, { role });
    await db.collection("users").doc(userRecord.uid).set({
      name,
      email,
      updatephonenumber,
      role,
      status,
      createdDate: new Date(),
      customerType,
      organizationCertification: customerType === "Organization" ? organizationCertification : null,
    });

    res.status(201).send({ message: "Customer created", userId: userRecord.uid });
  } catch (error) {
    res.status(500).send({ message: "Error creating user", error: error.message });
    console.log(error);
  }
});

// Get a User by ID
router.get("/user/:id",verifyCurrentUser, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.params.id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send({ message: "User not found" });
    }

    res.status(200).send(userDoc.data());
  } catch (error) {
    res.status(500).send({ message: "Error fetching user", error: error.message });
  }
});

// Update a User by ID
router.put("/user/:id",verifyCurrentUser, async (req, res) => {
  try {
    const userRef = db.collection("users").doc(req.params.id);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).send({ message: "User not found" });
    }
    await admin.auth().updateUser(req.params.id, { email: userDoc.email });


    await userRef.update(req.body);

    res.status(200).send({ message: "User updated successfully" });
  } catch (error) {
    res.status(500).send({ message: "Error updating user", error: error.message });
  }
});

// Get All Users by Role
const getUsersByRole = async (role, res) => {
  try {
    const snapshot = await db.collection("users").where("role", "==", role).get();

    if (snapshot.empty) {
      return res.status(404).send({ message: "No users found" });
    }

    const users = [];
    snapshot.forEach((doc) => {
      users.push({ id: doc.id, ...doc.data() });
    });

    res.status(200).send(users);
  } catch (error) {
    res.status(500).send({ message: "Error fetching users", error: error.message });
  }
};

// Get User by email
const getUserByEmail = async (email, res) => {
  try {
    const snapshot = await db.collection("users").where("email", "==", email).get();

    if (snapshot.empty) {
      return res.status(404).send({ message: "User not found" });
    }

    let user;
    snapshot.forEach((doc) => {
      user = { id: doc.id, ...doc.data() };
    });

    res.status(200).send(user);
  } catch (error) {
    res.status(500).send({ message: "Error fetching user", error: error.message });
  }
};


// Get All Users by Role
const getUsersByRoles = async (roles, res) => {
    try {
        const snapshot = await db.collection("users").where("role", "in", roles).get();

      if (snapshot.empty) {
        return res.status(404).send({ message: "No users found" });
      }
  
      const users = [];
      snapshot.forEach((doc) => {
        users.push({ id: doc.id, ...doc.data() });
      });
  
      res.status(200).send(users);
    } catch (error) {
      res.status(500).send({ message: "Error fetching users", error: error.message });
    }
  };

// Get All Main Branch Users
router.get("/users/main-branch",verifyAdmin, (req, res) => {
  getUsersByRole("S000admin01", res);
});

// Get All Outlet Users
router.get("/users/outlet",verifyAdminOutlets, (req, res) => {
  getUsersByRole("OutManager001", res);
});

// Get All Individual Customers
router.get("/users/customers",verifyAdminOutlets, (req, res) => {
  getUsersByRole("cus0001", res);
});

// Get All Organization Customers
router.get("/users/customers/organization",verifyAdminOutlets, (req, res) => {
  getUsersByRole("cus0001Org", res);
});

// Get All Individual and Organization Customers
router.get("/users/allcustomers",verifyAdminOutlets, (req, res) => {
    getUsersByRoles(["cus0001","cus0001"], res);
  });
  
 
 
  
  const generatePasswordResetLink = async (userEmail) => {
    const actionCodeSettings = {
      url: "http://localhost:3000/",
      handleCodeInApp: true,
    };
  
    try {
      const link = await admin.auth().generatePasswordResetLink(userEmail, actionCodeSettings);
      console.log("Generated Reset Link:", link);
      sendCustomPasswordResetEmail(userEmail, link);
      return link;
    } catch (error) {
      console.error("Error generating reset link:", error);
    }
  };
  
  const transporter = nodemailer.createTransport({
    service: "gmail", 
    auth: {
      user: "mrm.arfath@gmail.com", 
      pass: "awkv nktf iyzd ojbj", 
    },
  });

  const sendCustomPasswordResetEmail = async (email, link) => {
    try {
      const mailOptions = {
        from: '"Gas By Gas App Team" mrm.arfath@gmail.com', 
        to: email,
        subject: "Password Reset Request",
        html: `
          <p>Hi,</p>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <p><a href="${link}" style="color: blue; text-decoration: none;">Reset Password</a></p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>Thanks,<br>Gas By Gas App Team</p>
        `,
      };
  
      const info = await transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email}: ${info.response}`);
    } catch (error) {
      console.error("Error sending password reset email:", error);
    }
  };
  
  
// Forgot Password API
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    

    const userRecord = await admin.auth().getUserByEmail(email).catch(() => null);

    if (!userRecord) {
      return res.status(404).json({ error: "User with this email does not exist." });
    }

    const resetLink = await generatePasswordResetLink(email);

    res.json({ message: "Password reset email sent successfully.", resetLink });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    res.status(500).json({ error: error.message });
  }
});


// check-user API
router.post('/check-user', async (req, res) => {
  try {
    const { email } = req.body;
  
    console.log("Checking email:", email);

    const snapshot = await db.collection("users").where("email", "==", email).get();
    
    if (snapshot.empty) {
      console.log("User not found");
      return res.status(404).json({ exists: false, message: "User not found" });
    }

    const doc = snapshot.docs[0]; // Get the first matching document
    const user = { id: doc.id, ...doc.data() };

    console.log("User found:", user);
    return res.json({ exists: true, user });

  } catch (error) {
    console.error("Error checking user:", error);
    return res.status(500).json({ error: error.message });
  }
});


// router.post('/api/change-password',verifyCurrentUser, async (req, res) => {
//   try {
//       const { token, newPassword } = req.body;

//       if (!newPassword) {
//           return res.status(400).json({ message: "new password are required" });
//       }

//       // Verify the Firebase ID token to get the user UID
//       const decodedToken = await auth.verifyIdToken(token);
//       const uid = decodedToken.uid;

//       // Update user password
//       await auth.updateUser(uid, { password: newPassword });

//       res.json({ message: "Password changed successfully" });
//   } catch (error) {
//       console.error("Error updating password:", error);
//       res.status(500).json({ error: error.message });
//   }
// });

router.post("/change-password/:id",verifyCurrentUser, async (req, res) => {
  try {
    
    const { oldPassword, newPassword } = req.body;
    
    if ( !newPassword) {
      return res.status(400).json({ message: "New password are required" });
    }

    await admin.auth().updateUser(req.user.userId, { password: newPassword });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log(error.message);
  }
});

module.exports = router;
