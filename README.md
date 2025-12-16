# AssetVerse – Server Side API

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=white" alt="JWT" />
  <img src="https://img.shields.io/badge/Stripe-008CDD?style=for-the-badge&logo=stripe&logoColor=white" alt="Stripe" />
</p>

---

## 📌 Project Purpose

AssetVerse Server is the **backend API** for a B2B Corporate Asset Management System.  
It handles authentication, role-based authorization, asset management, employee affiliation, request processing, package enforcement, and Stripe payment integration.

---

## 🌐 Live Server URL

👉 **[https://asset-verse-server-site.vercel.app](https://asset-verse-server-site.vercel.app)**

---

## 🔐 Authentication & Security

- ✅ **Firebase Admin SDK** for token verification
- ✅ JWT-based authentication
- ✅ Secure token generation on login
- ✅ Role-based access control (HR & Employee)
- ✅ Protected routes using middleware

### 🛡️ Middleware Used

| Middleware | Purpose |
|------------|---------|
| `verifyFBToken` | Verifies Firebase ID token |
| `verifyHR` | Restricts access to HR-only routes |
| `verifyEmployee` | Restricts access to Employee-only routes |

---

## 👥 User Roles

### 🧑‍💼 HR Manager
- ✅ Register company with default package (5 employees)
- ✅ Add, edit, and delete company assets
- ✅ Approve / reject employee asset requests
- ✅ Track current employees vs package limit
- ✅ Upgrade subscription packages via Stripe
- ✅ View company analytics and reports
- ✅ Manage employee affiliations

### 👨‍💻 Employee
- ✅ Register independently without company affiliation
- ✅ Request assets from multiple companies
- ✅ View all assigned assets across companies
- ✅ Return returnable assets (optional)
- ✅ View team members by company
- ✅ Manage personal profile

---

## 🧾 API Endpoints

### 🔑 User Management

#### Create User (Public)
```http
POST /users
```
**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "hr" | "employee",
  "dateOfBirth": "1990-01-01",
  "photoURL": "https://example.com/photo.jpg",
  "companyName": "Tech Corp" (if role is hr),
  "companyLogo": "https://example.com/logo.png" (optional, if hr)
}
```

#### Check User by Email (Public)
```http
GET /users/check?email=user@example.com
```

#### Get User by Email (Protected)
```http
GET /users/:email
Headers: Authorization: Bearer <firebase-token>
```

#### Update User Role (Protected)
```http
PATCH /users/update-role/:email
Headers: Authorization: Bearer <firebase-token>
Body: { role, dateOfBirth, companyName (if hr) }
```

#### Get User Role (Protected)
```http
GET /users/:email/role
Headers: Authorization: Bearer <firebase-token>
```

---

### 📦 Assets Management

#### Add New Asset (Protected)
```http
POST /assets
Headers: Authorization: Bearer <firebase-token>
Body: {
  "assetName": "Laptop",
  "assetType": "Electronics",
  "quantity": 10,
  "assetImage": "url",
  "returnType": "returnable" | "non-returnable",
  "addedBy": { "email": "hr@company.com" }
}
```

#### Get All Assets (Protected, with filters)
```http
GET /assets?companyId=xyz&returnType=returnable
Headers: Authorization: Bearer <firebase-token>
```

#### Update Asset (Protected)
```http
PATCH /assets/:id
Headers: Authorization: Bearer <firebase-token>
Body: { assetName, quantity, etc. }
```

#### Delete Asset (Protected)
```http
DELETE /assets/:id
Headers: Authorization: Bearer <firebase-token>
```

---

### 📝 Asset Requests

#### Create Asset Request (Protected, Employee Only)
```http
POST /requests
Headers: Authorization: Bearer <firebase-token>
Body: {
  "assetId": "asset_id",
  "assetName": "Laptop",
  "employeeEmail": "employee@example.com",
  "employeeName": "John Doe",
  "additionalNotes": "Urgent need"
}
```

#### Get All Requests (Protected, with filters)
```http
GET /requests?employeeEmail=xxx&companyId=yyy
Headers: Authorization: Bearer <firebase-token>
```

#### Approve Request (Protected, HR Only)
```http
PATCH /requests/:id/approve
Headers: Authorization: Bearer <firebase-token>
```
**Logic:**
- Updates request status to `approved`
- Adds employee to company (auto-affiliation on first approval)
- Decrements asset quantity by 1
- Updates HR's current employee count
- Checks package limit before approval

#### Update Request (Protected)
```http
PATCH /requests/:id
Headers: Authorization: Bearer <firebase-token>
Body: { requestStatus: "approved" | "rejected" | "pending" }
```

#### Get Pending Count (Protected)
```http
GET /requests/pending-count
Headers: Authorization: Bearer <firebase-token>
```

#### Get Assigned Count (Protected)
```http
GET /requests/assigned-count
Headers: Authorization: Bearer <firebase-token>
```

---

### 🔔 Notifications

#### Get User Notifications (Protected)
```http
GET /notifications/:userId
Headers: Authorization: Bearer <firebase-token>
```

#### Mark Notification as Read (Protected)
```http
PATCH /notifications/:id/read
Headers: Authorization: Bearer <firebase-token>
Body: { "userId": "user_id" }
```

#### Mark All as Read (Protected)
```http
PATCH /notifications/mark-all-read
Headers: Authorization: Bearer <firebase-token>
Body: { "userId": "user_id" }
```

#### Get Unread Count (Protected)
```http
GET /notifications/:userId/unread-count
Headers: Authorization: Bearer <firebase-token>
```

#### Delete Notification (Protected)
```http
DELETE /notifications/:id
Headers: Authorization: Bearer <firebase-token>
Body: { "userId": "user_id" }
```

#### Clear Read Notifications (Protected)
```http
DELETE /notifications/clear-read
Headers: Authorization: Bearer <firebase-token>
Body: { "userId": "user_id" }
```

#### Get Company Analytics (Protected, HR Only)
```http
GET /notifications/company/:companyId/analytics
Headers: Authorization: Bearer <firebase-token>
```

---

### 👥 Employee Management

#### Get All Employees (Protected, HR Only)
```http
GET /employees
Headers: Authorization: Bearer <firebase-token>
```

#### Get Company Employees (Protected, HR Only)
```http
GET /employees/company/:companyId
Headers: Authorization: Bearer <firebase-token>
```

#### Delete Employee (Protected, HR Only)
```http
DELETE /employees/:id
Headers: Authorization: Bearer <firebase-token>
```

#### Assign Employees to HR (Protected, HR Only)
```http
POST /employees/assign-to-hr
Headers: Authorization: Bearer <firebase-token>
Body: {
  "assignments": [
    { "employeeEmail": "emp1@example.com", "hrEmail": "hr@company.com" },
    { "employeeEmail": "emp2@example.com", "hrEmail": "hr@company.com" }
  ]
}
```

#### Get All HRs (Protected)
```http
GET /hrs
Headers: Authorization: Bearer <firebase-token>
```

#### Get Employees with Companies (Protected)
```http
GET /employees/with-companies
Headers: Authorization: Bearer <firebase-token>
```

---

### 📊 Packages

#### Get All Packages (Public)
```http
GET /packages
```

**Response Example:**
```json
[
  {
    "_id": "1",
    "name": "Basic",
    "packageLimit": 5,
    "price": 0,
    "features": ["5 Employees", "Basic Support"]
  },
  {
    "_id": "2",
    "name": "Standard",
    "packageLimit": 10,
    "price": 8,
    "features": ["10 Employees", "Priority Support", "Analytics"]
  },
  {
    "_id": "3",
    "name": "Premium",
    "packageLimit": 20,
    "price": 15,
    "features": ["20 Employees", "24/7 Support", "Advanced Analytics", "Custom Reports"]
  }
]
```

---

### 💳 Payment & Subscription (Protected, HR Only)

#### Create Stripe Checkout Session
```http
POST /create-checkout-session
Headers: Authorization: Bearer <firebase-token>
Body: {
  "packageId": "package_id",
  "packageName": "Premium",
  "price": 15
}
```

#### Record Payment Success
```http
POST /payment-success
Headers: Authorization: Bearer <firebase-token>
Body: {
  "sessionId": "stripe_session_id",
  "hrEmail": "hr@company.com",
  "packageId": "package_id",
  "packageName": "Premium",
  "amount": 15
}
```
**Logic:**
- Saves payment record to database
- Updates HR's subscription and package limit
- Adds to subscription history

---

## 🔁 Core Business Logic

### 🔄 Auto Affiliation
When an HR approves an employee's **first asset request**:
1. ✅ Employee is automatically affiliated with the company
2. ✅ HR's `currentEmployees` count increases by 1
3. ✅ Employee can now request more assets from that company
4. ✅ Asset quantity decreases by 1

### 📊 Package Limit Enforcement
- ❌ HR **cannot approve** requests if `currentEmployees >= packageLimit`
- ⚠️ System shows error: "Package limit reached! Please upgrade."
- ✅ HR must upgrade package via Stripe to add more employees

### 🔄 Asset Return Flow (Optional Feature)
- Employee returns a returnable asset
- Request status updates to `returned`
- Asset quantity increases automatically

### 🔔 Notification System
- ✅ Asset added → Notifies all company members
- ✅ Request created → Notifies HR
- ✅ Request approved/rejected → Notifies employee
- ✅ Read/unread tracking for each user

---

## 📊 Analytics Support

API provides data for frontend analytics:
- 📈 **Pie Chart**: Returnable vs Non-returnable assets
- 📊 **Bar Chart**: Most requested assets
- 📉 **Company Stats**: Total notifications, read rates, employee counts
- Used by **Recharts** on client side

---

## 🗄️ Database Collections

```
├── users (HR and Employees)
├── assets (Company assets)
├── requests (Asset requests)
├── notifications (System notifications)
├── packages (Subscription packages)
└── payments (Payment records)
```

### Collection Schemas

#### Users Collection
```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String,
  role: "hr" | "employee",
  photoURL: String,
  dateOfBirth: String,
  
  // HR specific
  companyName: String,
  companyLogo: String,
  subscription: String,
  packageLimit: Number,
  currentEmployees: Number,
  
  // Employee specific
  affiliatedCompanies: [String], // Array of company IDs
  skills: [String],
  
  createdAt: Date
}
```

#### Assets Collection
```javascript
{
  _id: ObjectId,
  assetName: String,
  assetType: String,
  quantity: Number,
  assetImage: String,
  returnType: "returnable" | "non-returnable",
  status: "available",
  companyId: String, // HR's user ID
  addedBy: {
    uid: ObjectId,
    name: String,
    email: String
  },
  addedAt: Date
}
```

#### Requests Collection
```javascript
{
  _id: ObjectId,
  assetId: ObjectId,
  assetName: String,
  employeeEmail: String,
  employeeName: String,
  requestStatus: "pending" | "approved" | "rejected",
  requestDate: Date,
  approvedAt: Date,
  companyId: String,
  additionalNotes: String
}
```

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password
STRIPE_SECRET=your_stripe_secret_key
FB_SERVICE_KEY=your_base64_encoded_firebase_service_account
SITE_DOMAIN=https://your-client-domain.vercel.app
```

### 🔐 Firebase Service Account Setup

1. Go to Firebase Console → Project Settings → Service Accounts
2. Generate new private key (JSON file)
3. Convert to base64:
   ```bash
   # Linux/Mac
   base64 -i serviceAccount.json
   
   # Windows
   certutil -encode serviceAccount.json encoded.txt
   ```
4. Copy the base64 string to `FB_SERVICE_KEY` in `.env`

❗ **Important**: Never push `.env` files to GitHub. Add to `.gitignore`.

---

## ▶️ Run Server Locally

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/assetverse-server.git

# Navigate to project directory
cd assetverse-server

# Install dependencies
npm install

# Create .env file and add environment variables
# (See Environment Variables section above)

# Start the server
nodemon index.js
```

Server will run on:
```
http://localhost:3000
```

---

## 🛠️ Technologies Used

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime environment |
| **Express.js** | Web framework |
| **MongoDB** | Database |
| **Mongoose** | ODM for MongoDB |
| **Firebase Admin** | Authentication |
| **JWT** | Token verification |
| **Stripe** | Payment processing |
| **dotenv** | Environment variables |
| **cors** | Cross-origin requests |

---

## 🚀 Deployment (Vercel)

### 1. Create `vercel.json` in root:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

### 2. Add Environment Variables in Vercel:
- Go to Vercel Dashboard
- Select your project
- Settings → Environment Variables
- Add all variables from `.env`

### 3. Deploy:
```bash
git push origin main
```
Vercel will automatically deploy.

---

## ❗ Error Handling

- ✅ Try-catch blocks in all async routes
- ✅ Proper HTTP status codes (200, 201, 400, 401, 403, 404, 500)
- ✅ JSON formatted error responses
- ✅ Meaningful error messages
- ✅ Prevents invalid server responses

### Error Response Format:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details (optional)"
}
```

---

## ✅ Production Checklist

- [ ] CORS configured correctly for client domain
- [ ] MongoDB Atlas connection working
- [ ] All environment variables set in Vercel
- [ ] Firebase Admin SDK initialized
- [ ] Stripe webhook configured (if using)
- [ ] No sensitive data in code
- [ ] Error handling implemented
- [ ] API endpoints tested
- [ ] No 404 / 500 errors in production
- [ ] Rate limiting configured (optional)
- [ ] API documentation updated

---

## 📝 API Response Format

### Success Response:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response:
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional information"
}
```

---

## 🔒 Security Best Practices

1. ✅ All sensitive routes are protected with middleware
2. ✅ Passwords are not stored in responses
3. ✅ Firebase tokens expire automatically
4. ✅ MongoDB connection uses secure credentials
5. ✅ CORS only allows specific origins
6. ✅ Environment variables never exposed
7. ✅ Input validation on all routes

---

## 📞 Support & Contact

For issues or questions:
- 📧 Email: masumak203@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/masumBillah-1)


---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Firebase for authentication
- MongoDB for database
- Stripe for payment processing
- Vercel for hosting
- All open-source contributors

---

<p align="center">
  <strong>Built with ❤️ for efficient asset management</strong>
</p>

<p align="center">
  © 2025 AssetVerse – Server API
</p>
