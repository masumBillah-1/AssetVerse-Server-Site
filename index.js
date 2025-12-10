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


      // Add Assets api 


 app.post("/assets", async (req, res) => {
  try {
    const asset = req.body;

    if (!asset.assetName || !asset.assetType || !asset.quantity || !asset.returnType || !asset.addedBy?.email) {
      return res.status(400).send({ success: false, error: "Missing required fields" });
    }

    // MongoDB থেকে user খুঁজে পাওয়া
    const user = await userCollection.findOne({ email: asset.addedBy.email });

    if (!user) return res.status(404).send({ success: false, error: "User not found" });

    const newAsset = {
      assetName: asset.assetName,
      assetType: asset.assetType,
      quantity: Number(asset.quantity),
      assetImage: asset.assetImage || "",
      returnType: asset.returnType,
      status: "available",
      addedAt: new Date(),
      addedBy: {
        uid: user._id,   // MongoDB _id
        name: user.name,
        email: user.email,
      },
    };

    const result = await assetsCollection.insertOne(newAsset);
    res.send({ success: true, id: result.insertedId });

  } catch (error) {
    console.log(error);
    res.status(500).send({ success: false, error: "Failed to add asset" });
  }
});




    app.get("/assets", async (req, res) => {
  try {
    const filter = {};
    if (req.query.returnType) {
      filter.returnType = req.query.returnType; // optional query filter
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
      success_url: `http://localhost:5173/dashboard/success?session_id={CHECKOUT_SESSION_ID}`,
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
