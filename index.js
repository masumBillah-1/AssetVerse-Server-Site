const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()

const { MongoClient, ServerApiVersion } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const port = process.env.PORT || 3000

app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@myserverdb.wwgfr6w.mongodb.net/?appName=MyServerDB`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();

    const db = client.db('Asset_Verse_db');
    const userCollection = db.collection('users');
    const assetsCollection = db.collection("assets");
    const packageCollection = db.collection("packages");
    const paymentCollection = db.collection("payments");
    const requestsCollection = db.collection("requests");
    const notificationsCollection = db.collection("notifications");
 

    // ------------------------------
    //   CREATE USER (Google + Normal)
    // ------------------------------
    app.post("/users", async (req, res) => {
      try {
        const data = req.body;

        const newUser = {
          name: data.name || data.displayName || "",
          email: data.email,
          password: data.password || "", 
          role: data.role || "employee",
          photoURL: data.photoURL || data.photo || "",
          dateOfBirth: data.dateOfBirth || "",
          createdAt: new Date(),
        };

        if (data.role === "hr") {
          newUser.companyName = data.companyName;
          newUser.companyLogo = data.companyLogo || "";
          newUser.subscription = "basic";
          newUser.packageLimit = 5;
          newUser.currentEmployees = 0;
        }

        if (data.role === "employee") {
          newUser.skills = [];
          newUser.affiliatedCompanies = [];
        }

        const result = await userCollection.insertOne(newUser);
        res.send({ success: true, userId: result.insertedId });

      } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: "Server Error" });
      }
    });



    // 🆕 UPDATE USER ROLE & DETAILS
    app.patch("/users/update-role/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const data = req.body;

        const existingUser = await userCollection.findOne({ email });
        
        if (!existingUser) {
          return res.status(404).send({ success: false, message: "User not found" });
        }

        const updateData = {
          role: data.role,
          dateOfBirth: data.dateOfBirth,
          updatedAt: new Date()
        };

        if (data.role === "hr") {
          updateData.companyName = data.companyName;
          updateData.companyLogo = data.companyLogo || "";
          updateData.subscription = data.subscription || "basic";
          updateData.packageLimit = data.packageLimit || 5;
          updateData.currentEmployees = data.currentEmployees || 0;
        }

        if (data.role === "employee") {
          updateData.skills = existingUser.skills || [];
          updateData.affiliatedCompanies = existingUser.affiliatedCompanies || [];
        }

        const result = await userCollection.updateOne(
          { email },
          { $set: updateData }
        );

        if (result.modifiedCount > 0) {
          res.send({ 
            success: true, 
            message: "User updated successfully",
            token: "jwt-token-here" // JWT generate করুন
          });
        } else {
          res.send({ success: false, message: "No changes made" });
        }

      } catch (error) {
        console.log(error);
        res.status(500).send({ success: false, error: "Server Error" });
      }
    });


    // GET user role by email
        app.get('/users/:email/role', async (req, res) => {
          const email = req.params.email;
          const user = await userCollection.findOne({ email });

          if (!user) return res.status(404).send({ success: false, message: "User not found" });

          res.send({ role: user.role });
        });



   // server-এ subscription ফেরত দেওয়ার API  

    app.get("/users/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const user = await userCollection.findOne({ email });

    if (!user) {
      return res.status(404).send({ success: false, message: "User not found" });
    }

    res.send({
      success: true,
      user
    });

  } catch (error) {
    console.log(error);
    res.status(500).send({ success: false, message: "Server error" });
  }
});





    // ------------------------------
    //   GET ALL USERS
    // ------------------------------
    app.get('/users', async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // ------------------------------
    //   CHECK USER BY EMAIL
    // ------------------------------
    app.get("/users/check", async (req, res) => {
      try {
        const email = req.query.email;
        const user = await userCollection.findOne({ email });

        if (user) {
          return res.json({ found: true, user });
        } else {
          return res.json({ found: false });
        }
      } catch (err) {
        console.log(err);
        res.json({ found: false });
      }
    });


        // my team member api 

        // ===================================
// GET USER BY _ID (for fetching HR by companyId)
// ===================================
app.get("/users/by-id/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).send({ 
        success: false, 
        error: "Invalid user ID" 
      });
    }

    const user = await userCollection.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      return res.status(404).send({ 
        success: false, 
        message: "User not found" 
      });
    }

    res.send({
      success: true,
      user
    });

  } catch (error) {
    console.error('Error fetching user by ID:', error);
    res.status(500).send({ 
      success: false, 
      message: "Server error" 
    });
  }
});







      // Add Assets api 
// Add Assets api - UPDATED FOR MULTI-USER NOTIFICATIONS
// ✅ Add Assets - Create notifications for ALL company members
app.post("/assets", async (req, res) => {
  try {
    const asset = req.body;

    if (!asset.assetName || !asset.assetType || !asset.quantity || !asset.returnType || !asset.addedBy?.email) {
      return res.status(400).send({ success: false, error: "Missing required fields" });
    }

    // Find the user who is adding the asset
    const user = await userCollection.findOne({ email: asset.addedBy.email });
    if (!user) return res.status(404).send({ success: false, error: "User not found" });

    // ✅ Determine company identifier (HR's _id)
    let companyId;
    if (user.role === "hr") {
      companyId = user._id.toString(); // HR এর _id = company identifier
    } else if (user.role === "employee") {
      companyId = user.affiliatedCompanies?.[0]; // Employee এর company ID
    }

    if (!companyId) {
      return res.status(400).send({ 
        success: false, 
        error: "Company ID not found. Employee must be affiliated with a company." 
      });
    }

    const newAsset = {
      assetName: asset.assetName,
      assetType: asset.assetType,
      quantity: Number(asset.quantity),
      assetImage: asset.assetImage || "",
      returnType: asset.returnType,
      status: "available",
      addedAt: new Date(),
      addedBy: {
        uid: user._id,
        name: user.name,
        email: user.email,
      },
      companyId: companyId // ✅ Store company ID instead of email
    };

    // Insert asset
    const result = await assetsCollection.insertOne(newAsset);

    // ✅ Find ALL users in the same company
    let companyMembers = [];
    
    if (user.role === "hr") {
      // HR হলে: HR নিজে + তার সব employees
      const employees = await userCollection.find({
        role: "employee",
        affiliatedCompanies: user._id.toString()
      }).toArray();

      companyMembers = [user, ...employees]; // HR + employees
      
    } else if (user.role === "employee") {
      // Employee হলে: সেই company এর HR + সব employees
      const hr = await userCollection.findOne({ 
        _id: new ObjectId(companyId),
        role: "hr" 
      });

      const employees = await userCollection.find({
        role: "employee",
        affiliatedCompanies: companyId
      }).toArray();

      companyMembers = hr ? [hr, ...employees] : employees;
    }

    console.log(`✅ Found ${companyMembers.length} members in company: ${companyId}`);

    // ✅ প্রতিটি company member এর জন্য আলাদা notification
    const notifications = companyMembers.map(member => ({
      userId: member._id,
      assetId: result.insertedId,
      message: `${user.name} added a new asset: ${newAsset.assetName}`,
      date: new Date(),
      readBy: [],
      companyId: companyId,
      notificationType: "asset_added"
    }));

    // ✅ সব notifications insert করুন
    if (notifications.length > 0) {
      await notificationsCollection.insertMany(notifications);
      console.log(`✅ Created ${notifications.length} notifications for company: ${companyId}`);
    }

    res.send({ 
      success: true, 
      id: result.insertedId, 
      notificationsCreated: notifications.length,
      companyId: companyId
    });

  } catch (error) {
    console.error("❌ Asset add error:", error);
    res.status(500).send({ success: false, error: "Failed to add asset" });
  }
});


// notifications  api 
// ✅ Get notifications - Now uses company ID
app.get("/notifications/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Find user to get their info
    const user = await userCollection.findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).send({ success: false, error: "User not found" });
    }

    // ✅ Fetch notifications for this specific user
    const notifications = await notificationsCollection
      .find({ userId: new ObjectId(userId) })
      .sort({ date: -1 })
      .toArray();

    // ✅ প্রতিটি notification এ check করুন এই user এর জন্য read কিনা
    const notificationsWithReadStatus = notifications.map(notif => ({
      ...notif,
      read: notif.readBy?.some(id => id.toString() === userId.toString()) || false
    }));

    res.send({ 
      success: true, 
      notifications: notificationsWithReadStatus 
    });

  } catch (err) {
    console.error("❌ Notification fetch error:", err);
    res.status(500).send({ success: false, error: "Failed to fetch notifications" });
  }
});
// ===================================
// MARK SINGLE NOTIFICATION AS READ
// ===================================
app.patch("/notifications/:id/read", async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.body.userId;

    if (!userId) {
      return res.status(400).send({ success: false, error: "userId is required" });
    }

    // Validate notificationId format
    if (!ObjectId.isValid(notificationId)) {
      return res.status(400).send({ success: false, error: "Invalid notification ID" });
    }

    // ✅ Check if notification exists and belongs to this user
    const notification = await notificationsCollection.findOne({ 
      _id: new ObjectId(notificationId),
      userId: new ObjectId(userId)
    });

    if (!notification) {
      return res.status(404).send({ 
        success: false, 
        error: "Notification not found or unauthorized" 
      });
    }

    // ✅ Check if already read by this user
    const alreadyRead = notification.readBy?.some(
      id => id.toString() === userId.toString()
    );

    if (alreadyRead) {
      return res.send({ 
        success: true, 
        message: "Notification already marked as read",
        alreadyRead: true
      });
    }

    // ✅ Add userId to readBy array
    const result = await notificationsCollection.updateOne(
      { _id: new ObjectId(notificationId) },
      { $addToSet: { readBy: new ObjectId(userId) } }
    );

    if (result.modifiedCount > 0) {
      res.send({ 
        success: true, 
        message: "Notification marked as read",
        alreadyRead: false
      });
    } else {
      res.status(500).send({ 
        success: false, 
        error: "Failed to update notification" 
      });
    }

  } catch (err) {
    console.error("❌ Notification read error:", err);
    res.status(500).send({ 
      success: false, 
      error: "Failed to mark notification as read" 
    });
  }
});

// ===================================
// MARK ALL NOTIFICATIONS AS READ
// ===================================
app.patch("/notifications/mark-all-read", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ success: false, error: "userId is required" });
    }

    // Validate userId format
    if (!ObjectId.isValid(userId)) {
      return res.status(400).send({ success: false, error: "Invalid user ID" });
    }

    // ✅ Mark all notifications for THIS USER as read
    const result = await notificationsCollection.updateMany(
      { 
        userId: new ObjectId(userId), // Only this user's notifications
        readBy: { $ne: new ObjectId(userId) } // Not already read
      },
      { $addToSet: { readBy: new ObjectId(userId) } }
    );

    res.send({ 
      success: true, 
      message: `${result.modifiedCount} notifications marked as read`,
      totalMarked: result.modifiedCount
    });

  } catch (err) {
    console.error("❌ Bulk read error:", err);
    res.status(500).send({ 
      success: false, 
      error: "Failed to mark all as read" 
    });
  }
});

// ===================================
// GET UNREAD NOTIFICATION COUNT
// ===================================
app.get("/notifications/:userId/unread-count", async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).send({ success: false, error: "Invalid user ID" });
    }

    const count = await notificationsCollection.countDocuments({
      userId: new ObjectId(userId),
      $or: [
        { readBy: { $exists: false } },
        { readBy: { $size: 0 } },
        { readBy: { $ne: new ObjectId(userId) } }
      ]
    });

    res.send({ 
      success: true, 
      unreadCount: count 
    });

  } catch (err) {
    console.error("❌ Unread count error:", err);
    res.status(500).send({ 
      success: false, 
      error: "Failed to get unread count" 
    });
  }
});

// ===================================
// DELETE NOTIFICATION (OPTIONAL)
// ===================================
app.delete("/notifications/:id", async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.body.userId; // Or from JWT token

    if (!userId) {
      return res.status(400).send({ success: false, error: "userId is required" });
    }

    if (!ObjectId.isValid(notificationId)) {
      return res.status(400).send({ success: false, error: "Invalid notification ID" });
    }

    // ✅ Only allow users to delete their own notifications
    const result = await notificationsCollection.deleteOne({
      _id: new ObjectId(notificationId),
      userId: new ObjectId(userId)
    });

    if (result.deletedCount > 0) {
      res.send({ 
        success: true, 
        message: "Notification deleted successfully" 
      });
    } else {
      res.status(404).send({ 
        success: false, 
        error: "Notification not found or unauthorized" 
      });
    }

  } catch (err) {
    console.error("❌ Delete notification error:", err);
    res.status(500).send({ 
      success: false, 
      error: "Failed to delete notification" 
    });
  }
});

// ===================================
// CLEAR ALL READ NOTIFICATIONS
// ===================================
app.delete("/notifications/clear-read", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).send({ success: false, error: "userId is required" });
    }

    if (!ObjectId.isValid(userId)) {
      return res.status(400).send({ success: false, error: "Invalid user ID" });
    }

    // ✅ Delete all read notifications for this user
    const result = await notificationsCollection.deleteMany({
      userId: new ObjectId(userId),
      readBy: new ObjectId(userId)
    });

    res.send({ 
      success: true, 
      message: `${result.deletedCount} read notifications cleared`,
      totalCleared: result.deletedCount
    });

  } catch (err) {
    console.error("❌ Clear notifications error:", err);
    res.status(500).send({ 
      success: false, 
      error: "Failed to clear notifications" 
    });
  }
});

// ===================================
// GET WHO READ A NOTIFICATION (ADMIN/DEBUG)
// ===================================
app.get("/notifications/:id/read-by", async (req, res) => {
  try {
    const notificationId = req.params.id;

    if (!ObjectId.isValid(notificationId)) {
      return res.status(400).send({ success: false, error: "Invalid notification ID" });
    }

    // Get the notification
    const notification = await notificationsCollection.findOne({ 
      _id: new ObjectId(notificationId) 
    });

    if (!notification) {
      return res.status(404).send({ 
        success: false, 
        error: "Notification not found" 
      });
    }

    // If readBy is empty
    if (!notification.readBy || notification.readBy.length === 0) {
      return res.send({
        success: true,
        notificationId: notification._id,
        message: notification.message,
        totalReads: 0,
        readBy: [],
        readByUsers: []
      });
    }

    // Get user details for each reader
    const readByUsers = await userCollection.find({
      _id: { $in: notification.readBy.map(id => new ObjectId(id)) }
    }).toArray();

    // Format response
    const readers = readByUsers.map(user => ({
      userId: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      photoURL: user.photoURL
    }));

    res.send({
      success: true,
      notificationId: notification._id,
      message: notification.message,
      assetId: notification.assetId,
      date: notification.date,
      totalReads: notification.readBy.length,
      readBy: notification.readBy, // Array of user IDs
      readByUsers: readers // Full user details
    });

  } catch (err) {
    console.error("❌ Read-by fetch error:", err);
    res.status(500).send({ 
      success: false, 
      error: "Failed to fetch read status" 
    });
  }
});

// ===================================
// GET ALL NOTIFICATIONS WITH READ STATUS (FOR HR ANALYTICS)
// ===================================
app.get("/notifications/company/:companyId/analytics", async (req, res) => {
  try {
    const companyId = req.params.companyId;

    if (!ObjectId.isValid(companyId)) {
      return res.status(400).send({ success: false, error: "Invalid company ID" });
    }

    // Get all notifications for this company
    const notifications = await notificationsCollection.find({
      companyId: companyId
    }).sort({ date: -1 }).toArray();

    // Enrich with read statistics
    const enrichedNotifications = await Promise.all(
      notifications.map(async (notif) => {
        const totalReaders = notif.readBy?.length || 0;
        
        // Get reader details if any
        let readers = [];
        if (totalReaders > 0) {
          const users = await userCollection.find({
            _id: { $in: notif.readBy.map(id => new ObjectId(id)) }
          }).toArray();

          readers = users.map(u => ({
            name: u.name,
            email: u.email,
            role: u.role
          }));
        }

        return {
          _id: notif._id,
          message: notif.message,
          date: notif.date,
          notificationType: notif.notificationType,
          totalReads: totalReaders,
          readers: readers
        };
      })
    );

    // Calculate analytics
    const totalNotifications = notifications.length;
    const totalReads = notifications.reduce((sum, n) => sum + (n.readBy?.length || 0), 0);
    const avgReadsPerNotification = totalNotifications > 0 ? (totalReads / totalNotifications).toFixed(2) : 0;

    res.send({
      success: true,
      companyId: companyId,
      analytics: {
        totalNotifications,
        totalReads,
        avgReadsPerNotification,
        unreadNotifications: notifications.filter(n => !n.readBy || n.readBy.length === 0).length
      },
      notifications: enrichedNotifications
    });

  } catch (err) {
    console.error("❌ Analytics error:", err);
    res.status(500).send({ 
      success: false, 
      error: "Failed to fetch analytics" 
    });
  }
});








app.get("/assets", async (req, res) => {
  try {
    const filter = {};
    
    // Filter by companyId if provided
    if (req.query.companyId) {
      filter.companyId = req.query.companyId;
    }
    
    if (req.query.returnType) {
      filter.returnType = req.query.returnType;
    }

    const result = await assetsCollection.find(filter).sort({ addedAt: -1 }).toArray();
    res.send(result);
  } catch (err) {
    console.log(err);
    res.status(500).send({ success: false, error: "Failed to fetch assets" });
  }
});


const { ObjectId } = require('mongodb');

app.delete("/assets/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await assetsCollection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount > 0) {
      res.send({ success: true, message: "Asset deleted successfully" });
    } else {
      res.status(404).send({ success: false, message: "Asset not found" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send({ success: false, message: "Failed to delete asset" });
  }
});


app.patch("/assets/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;

    const result = await assetsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: data }
    );

    if (result.modifiedCount > 0) {
      res.send({ success: true, message: "Asset updated successfully" });
    } else {
      res.status(404).send({ success: false, message: "Asset not found or no changes made" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send({ success: false, message: "Failed to update asset" });
  }
});

// --------------------------------------
//  GET only employees
// --------------------------------------

app.get("/employees", async (req, res) => {
  try {
    const result = await userCollection.find({ role: "employee" }).toArray();
    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({ success: false, error: "Failed to fetch employees" });
  }
});

app.delete("/employees/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const result = await userCollection.deleteOne({ _id: new ObjectId(id) });

    res.send(result);
  } catch (error) {
    console.log(error);
    res.status(500).send({ success: false, error: "Failed to delete employee" });
  }
});



 // ===================================
// 📌 ASSET REQUEST - Employee requests, HR gets notification
// ===================================
app.post("/requests", async (req, res) => {
  try {
    const requestData = req.body;

    // Find employee
    const employee = await userCollection.findOne({ 
      email: requestData.employeeEmail,
      role: "employee"
    });

    if (!employee) {
      return res.status(404).send({ 
        success: false, 
        error: "Employee not found" 
      });
    }

    // Find asset to get company ID
    const asset = await assetsCollection.findOne({ 
      _id: new ObjectId(requestData.assetId) 
    });

    if (!asset) {
      return res.status(404).send({ 
        success: false, 
        error: "Asset not found" 
      });
    }

    const companyId = asset.companyId;

    // Create request
    const newRequest = {
      ...requestData,
      requestStatus: "pending",
      requestDate: new Date(),
      companyId: companyId
    };

    const result = await requestsCollection.insertOne(newRequest);

    // ✅ NEW: Find HR and send notification
    const hr = await userCollection.findOne({ 
      _id: new ObjectId(companyId),
      role: "hr" 
    });

    if (hr) {
      // ✅ Create notification for HR
      await notificationsCollection.insertOne({
        userId: hr._id,
        requestId: result.insertedId,
        assetId: new ObjectId(requestData.assetId),
        message: `${employee.name} requested asset: ${requestData.assetName}`,
        date: new Date(),
        readBy: [],
        companyId: companyId,
        notificationType: "asset_request"
      });

      console.log(`✅ Notification sent to HR: ${hr.name}`);
    }

    res.send({ 
      success: true,
      requestId: result.insertedId
    });

  } catch (error) {
    console.error("❌ Request creation error:", error);
    res.status(500).send({ 
      success: false, 
      error: "Failed to create request" 
    });
  }
});

// Get requests by employee email
// Get requests - filtered by companyId
app.get("/requests", async (req, res) => {
  try {
    const { employeeEmail, companyId } = req.query;
    
    let filter = {};
    
    // Filter by employee email (for employee dashboard)
    if (employeeEmail) {
      filter.employeeEmail = employeeEmail;
    }
    
    // ✅ Filter by companyId (for HR dashboard)
    if (companyId) {
      filter.companyId = companyId;
    }
    
    const result = await requestsCollection
      .find(filter)
      .sort({ requestDate: -1 })
      .toArray();
      
    res.send(result);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).send({ error: "Failed to fetch requests" });
  }
});

// Update request (for return)
app.patch("/requests/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.body;
    const result = await requestsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: data }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ error: "Failed to update request" });
  }
});

// ✅ নতুন route - এখানে add করুন
// ✅ Approve Request - Store HR's _id instead of email
// ✅ Approve Request - WITH PACKAGE LIMIT CHECK
app.patch("/requests/:id/approve", async (req, res) => {
  try {
    const requestId = req.params.id;
    
    // Get the request details
    const request = await requestsCollection.findOne({ _id: new ObjectId(requestId) });
    
    if (!request) {
      return res.status(404).send({ success: false, message: "Request not found" });
    }

    // Get the employee details
    const employee = await userCollection.findOne({ email: request.employeeEmail });
    
    if (!employee) {
      return res.status(404).send({ success: false, message: "Employee not found" });
    }

    // Get the asset to find company
    const asset = await assetsCollection.findOne({ _id: new ObjectId(request.assetId) });
    
    if (!asset) {
      return res.status(404).send({ success: false, message: "Asset not found" });
    }

    // Find HR by companyId
    const hr = await userCollection.findOne({ 
      _id: new ObjectId(asset.companyId),
      role: "hr" 
    });

    if (!hr) {
      return res.status(404).send({ 
        success: false, 
        message: "HR not found for this company" 
      });
    }

    console.log(`✅ Found HR: ${hr.name} (${hr._id})`);

    // ✅ CHECK PACKAGE LIMIT BEFORE APPROVING
    const currentEmployees = hr.currentEmployees || 0;
    const packageLimit = hr.packageLimit || 5;

    console.log(`📊 Current Employees: ${currentEmployees}, Package Limit: ${packageLimit}`);

    if (currentEmployees >= packageLimit) {
      return res.status(403).send({ 
        success: false, 
        limitReached: true,
        message: `Package limit reached! You have ${currentEmployees}/${packageLimit} employees. Please upgrade your package to add more employees.`,
        currentEmployees,
        packageLimit
      });
    }

    // ✅ Limit OK - Proceed with approval
    
    // Update request status to approved
    await requestsCollection.updateOne(
      { _id: new ObjectId(requestId) },
      { 
        $set: { 
          requestStatus: 'approved',
          approvedAt: new Date()
        }
      }
    );

    // Add HR's _id to employee's affiliatedCompanies
    const updateResult = await userCollection.updateOne(
      { email: request.employeeEmail },
      { 
        $addToSet: { 
          affiliatedCompanies: hr._id.toString()
        }
      }
    );

    // Decrease asset quantity by 1
    await assetsCollection.updateOne(
      { _id: new ObjectId(request.assetId) },
      { $inc: { quantity: -1 } }
    );

    // ✅ Update HR's currentEmployees count
    const newEmployeeCount = await userCollection.countDocuments({
      role: "employee",
      affiliatedCompanies: hr._id.toString()
    });

    await userCollection.updateOne(
      { _id: hr._id },
      { 
        $set: { 
          currentEmployees: newEmployeeCount,
          updatedAt: new Date()
        }
      }
    );

    console.log(`✅ Employee count updated: ${currentEmployees} → ${newEmployeeCount}`);

    res.send({ 
      success: true, 
      message: "Request approved successfully",
      affiliationUpdated: updateResult.modifiedCount > 0,
      hrId: hr._id,
      hrName: hr.name,
      companyName: hr.companyName,
      currentEmployees: newEmployeeCount,
      packageLimit: packageLimit
    });

  } catch (error) {
    console.error("❌ Approve request error:", error);
    res.status(500).send({ success: false, error: "Failed to approve request" });
  }
});



// Get Pending Requests Count
app.get("/requests/pending-count", async (req, res) => {
  try {
    const count = await requestsCollection.countDocuments({ requestStatus: "pending" });
    res.send({ success: true, pending: count });
  } catch (error) {
    console.log(error);
    res.status(500).send({ success: false, error: "Failed to get pending count" });
  }
});

// / GET approved/assigned requests count
app.get("/requests/assigned-count", async (req, res) => {
  try {
    const count = await requestsCollection.countDocuments({ requestStatus: "approved" });
    res.send({ assigned: count });
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: "Failed to fetch assigned count" });
  }
});










  // package api call 

app.get("/packages", async (req, res) => {
  try {
    const packages = await db.collection("packages").find().toArray();
    res.send(packages);
  } catch (error) {
    console.log(error);
    res.status(500).send({ success: false, error: "Failed to fetch packages" });
  }
});



    //   -----------------
     // payment Section api
    // -------------------

app.post('/create-checkout-session', async (req, res) => {
  const { packageId, packageName, price } = req.body;
  
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: packageName },
            unit_amount: price * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `http://localhost:5173/hr-dashboard/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5173/dashboard/cancel`,
    });
    
    res.send({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Failed to create checkout session' });
  }
});

app.post('/payment-success', async (req, res) => {
  const { sessionId, hrEmail, packageId, packageName, amount } = req.body;
  
  console.log('📦 Received payment data:', { sessionId, hrEmail, packageId, packageName, amount });
  
  try {
    // Validate required fields
    if (!sessionId || !hrEmail || !packageId || !packageName || !amount) {
      console.error('❌ Missing fields:', { sessionId, hrEmail, packageId, packageName, amount });
      return res.status(400).send({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    // Check if payment already exists (prevent duplicates)
    const existingPayment = await paymentCollection.findOne({ stripeSessionId: sessionId });
    
    if (existingPayment) {
      console.log('⚠️ Payment already recorded');
      return res.send({ 
        success: true, 
        message: 'Payment already recorded',
        paymentId: existingPayment._id 
      });
    }

    // Fetch package details from database
    const packageDetails = await packageCollection.findOne({ _id: new ObjectId(packageId) });
    
    if (!packageDetails) {
      console.error('❌ Package not found:', packageId);
      return res.status(404).send({ 
        success: false, 
        error: 'Package not found in database' 
      });
    }

    console.log('✅ Package found:', packageDetails);

    // Save payment record
    const paymentData = {
      hrEmail,
      packageId,
      packageName,
      amount: parseFloat(amount),
      currency: 'USD',
      paymentStatus: 'paid',
      paymentMethod: 'stripe',
      stripeSessionId: sessionId,
      paidAt: new Date()
    };
    
    const paymentResult = await paymentCollection.insertOne(paymentData);
    console.log('✅ Payment saved:', paymentResult.insertedId);
    
   // Update user subscription + push to subscriptionHistory
const updateResult = await userCollection.updateOne(
  { email: hrEmail },
  { 
    $set: { 
      subscription: packageDetails.name.toLowerCase(), // latest package
      packageLimit: packageDetails.packageLimit,
      subscriptionStartDate: new Date(),
      updatedAt: new Date()
    },
    $push: { // sequential purchase history
      subscriptionHistory: {
        packageName: packageDetails.name,
        amount: parseFloat(amount),
        date: new Date()
      }
    }
  }
);

    if (updateResult.matchedCount === 0) {
      console.error('❌ User not found:', hrEmail);
      return res.status(404).send({ 
        success: false, 
        error: 'User not found with this email' 
      });
    }

    console.log('✅ User subscription updated for:', hrEmail);

    res.send({ 
      success: true, 
      paymentId: paymentResult.insertedId,
      message: 'Payment recorded and subscription updated successfully',
      subscriptionDetails: {
        packageName: packageDetails.name,
        packageLimit: packageDetails.packageLimit,
        features: packageDetails.features
      }
    });

  } catch (err) {
    console.error('❌ Payment save error:', err);
    res.status(500).send({ 
      success: false, 
      error: 'Failed to save payment',
      details: err.message 
    });
  }
});




/// ===================================
// GET EMPLOYEES BY COMPANY ID (for HR's team)
// ===================================
app.get("/employees/company/:companyId", async (req, res) => {
  try {
    const companyId = req.params.companyId;

    if (!ObjectId.isValid(companyId)) {
      return res.status(400).send({ 
        success: false, 
        error: "Invalid company ID" 
      });
    }

    // Find all employees affiliated with this company (HR's _id)
    const employees = await userCollection.find({
      role: "employee",
      affiliatedCompanies: companyId
    }).toArray();

    res.send({ 
      success: true, 
      employees,
      count: employees.length 
    });

  } catch (error) {
    console.error("❌ Fetch employees error:", error);
    res.status(500).send({ 
      success: false, 
      error: "Failed to fetch employees" 
    });
  }
});

// ===================================
// MANUALLY ASSIGN EMPLOYEES TO CORRECT HR
// ===================================
app.post("/employees/assign-to-hr", async (req, res) => {
  try {
    const { assignments } = req.body;
    // assignments format: [{ employeeEmail: "...", hrEmail: "..." }, ...]

    if (!assignments || !Array.isArray(assignments)) {
      return res.status(400).send({ 
        success: false, 
        error: "assignments array is required" 
      });
    }

    const results = [];

    for (const assignment of assignments) {
      const { employeeEmail, hrEmail } = assignment;

      // Verify HR exists
      const hr = await userCollection.findOne({ email: hrEmail, role: "hr" });
      if (!hr) {
        results.push({ 
          employeeEmail, 
          success: false, 
          error: "HR not found" 
        });
        continue;
      }

      // Verify Employee exists
      const employee = await userCollection.findOne({ 
        email: employeeEmail, 
        role: "employee" 
      });
      
      if (!employee) {
        results.push({ 
          employeeEmail, 
          success: false, 
          error: "Employee not found" 
        });
        continue;
      }

      // Update employee's affiliatedCompanies
      await userCollection.updateOne(
        { email: employeeEmail },
        { 
          $set: { 
            affiliatedCompanies: [hrEmail],
            updatedAt: new Date()
          }
        }
      );

      results.push({ 
        employeeEmail, 
        hrEmail,
        success: true, 
        message: `${employee.name} assigned to ${hr.companyName}` 
      });
    }

    // Update each HR's currentEmployees count
    const hrEmails = [...new Set(assignments.map(a => a.hrEmail))];
    
    for (const hrEmail of hrEmails) {
      const employeeCount = await userCollection.countDocuments({
        role: "employee",
        affiliatedCompanies: hrEmail
      });

      await userCollection.updateOne(
        { email: hrEmail },
        { 
          $set: { 
            currentEmployees: employeeCount,
            updatedAt: new Date()
          }
        }
      );
    }

    res.send({ 
      success: true, 
      results,
      totalProcessed: assignments.length
    });

  } catch (error) {
    console.error("❌ Assign employees error:", error);
    res.status(500).send({ 
      success: false, 
      error: "Failed to assign employees" 
    });
  }
});

// ===================================
// GET ALL HRs AND THEIR COMPANIES
// ===================================
app.get("/hrs", async (req, res) => {
  try {
    const hrs = await userCollection.find({ role: "hr" }).toArray();

    const hrList = await Promise.all(
      hrs.map(async (hr) => {
        const employeeCount = await userCollection.countDocuments({
          role: "employee",
          affiliatedCompanies: hr.email
        });

        return {
          _id: hr._id,
          name: hr.name,
          email: hr.email,
          companyName: hr.companyName,
          companyLogo: hr.companyLogo,
          currentEmployees: employeeCount,
          packageLimit: hr.packageLimit,
          subscription: hr.subscription
        };
      })
    );

    res.send({ 
      success: true, 
      hrs: hrList,
      totalCompanies: hrList.length
    });

  } catch (error) {
    console.error("❌ Get HRs error:", error);
    res.status(500).send({ 
      success: false, 
      error: "Failed to fetch HRs" 
    });
  }
});

// ===================================
// VIEW ALL EMPLOYEES WITH THEIR COMPANIES
// ===================================
app.get("/employees/with-companies", async (req, res) => {
  try {
    const employees = await userCollection.find({ role: "employee" }).toArray();

    const employeeList = await Promise.all(
      employees.map(async (emp) => {
        const companies = [];
        
        if (emp.affiliatedCompanies && emp.affiliatedCompanies.length > 0) {
          for (const hrEmail of emp.affiliatedCompanies) {
            const hr = await userCollection.findOne({ 
              email: hrEmail, 
              role: "hr" 
            });
            
            if (hr) {
              companies.push({
                hrEmail: hr.email,
                companyName: hr.companyName
              });
            }
          }
        }

        return {
          _id: emp._id,
          name: emp.name,
          email: emp.email,
          photoURL: emp.photoURL,
          affiliatedCompanies: companies,
          hasCompany: companies.length > 0
        };
      })
    );

    res.send({ 
      success: true, 
      employees: employeeList,
      totalEmployees: employeeList.length,
      employeesWithCompany: employeeList.filter(e => e.hasCompany).length,
      employeesWithoutCompany: employeeList.filter(e => !e.hasCompany).length
    });

  } catch (error) {
    console.error("❌ Get employees error:", error);
    res.status(500).send({ 
      success: false, 
      error: "Failed to fetch employees" 
    });
  }
});









    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } finally {
    // client.close disabled
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('✔️ Server Connected!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
});
