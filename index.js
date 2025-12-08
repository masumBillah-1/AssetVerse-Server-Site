const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()

const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 3000


// middleware 

app.use(express.json());
app.use(cors())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@myserverdb.wwgfr6w.mongodb.net/?appName=MyServerDB`;



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();



    const db = client.db('Asset_Verse_db')
    const userCollection = db.collection('users')




app.post("/users", async (req, res) => {
  try {
    const data = req.body;

    // Common user fields
    const newUser = {
      name: data.name,
      email: data.email,
      password: data.password, // চাইলে bcrypt করতে পারো
      role: data.role,
      userphoto: data.photo || data.photoURL || "", // ← এখানে ফ্রন্টেন্ড থেকে আসা image URL ব্যবহার
      dateOfBirth: data.dateOfBirth,
      createdAt: new Date(),
    };

    // HR হলে অতিরিক্ত fields
    if (data.role === "hr") {
      newUser.companyName = data.companyName;
      newUser.companyLogo = data.companyLogo || "";
      newUser.subscription = "basic"; // default
      newUser.packageLimit = 5;
      newUser.currentEmployees = 0;
    }

    // Employee হলে অতিরিক্ত fields
    if (data.role === "employee") {
      newUser.skills = [];
      newUser.affiliatedCompanies = [];
    }

    const result = await userCollection.insertOne(newUser);
    res.send({ success: true, userId: result.insertedId });

  } catch (error) {
    console.log(error);
    res.status(500).send({ success: false, error: "Internal Server Error" });
  }
});



    // Send a ping to confirm a successful connection

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AssetVerse API</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', sans-serif;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            background: #063A3A;
            position: relative;
            overflow: hidden;
          }

          body::before {
            content: '';
            position: absolute;
            width: 300px;
            height: 300px;
            background: radial-gradient(circle, rgba(203, 220, 189, 0.15) 0%, transparent 70%);
            border-radius: 50%;
            top: -50px;
            right: -50px;
            animation: float 6s ease-in-out infinite;
          }

          @keyframes float {
            0%, 100% { transform: translate(0, 0); }
            50% { transform: translate(-20px, 20px); }
          }

          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .card {
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(10px);
            padding: 50px 60px;
            border-radius: 24px;
            border: 1px solid rgba(203, 220, 189, 0.2);
            text-align: center;
            animation: fadeIn 0.6s ease-out;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          }

          .icon {
            font-size: 64px;
            margin-bottom: 20px;
            display: inline-block;
            animation: pulse 2s ease-in-out infinite;
          }

          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }

          h1 {
            font-size: 28px;
            color: #CBDCBD;
            margin-bottom: 12px;
            font-weight: 600;
          }

          p {
            font-size: 16px;
            color: #CBDCBD;
            opacity: 0.8;
          }

          .status {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 25px;
            padding: 8px 20px;
            background: rgba(74, 222, 128, 0.15);
            border-radius: 20px;
            font-size: 14px;
            color: #4ade80;
          }

          .dot {
            width: 8px;
            height: 8px;
            background: #4ade80;
            border-radius: 50%;
            animation: blink 2s ease-in-out infinite;
          }

          @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }

          @media (max-width: 768px) {
            .card {
              padding: 40px 30px;
              margin: 20px;
            }
            h1 {
              font-size: 24px;
            }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">🚀</div>
          <h1>Server Connected</h1>
          <p>AssetVerse API Running</p>
          <div class="status">
            <span class="dot"></span>
            <span>Online</span>
          </div>
        </div>
      </body>
    </html>
  `);
});



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})