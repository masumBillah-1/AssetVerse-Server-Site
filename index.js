const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()

const { MongoClient, ServerApiVersion } = require('mongodb');
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
