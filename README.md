<div align="center">

<img src="client/src/assets/logo.svg" alt="GreenCart" width="260" />

### Fresh groceries, delivered fast — with live order tracking

A full-stack grocery delivery app inspired by Blinkit and Zepto: browse products, pay by card or cash,
and follow your order from the store to your door.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-greencart--frontend1.vercel.app-4fbf8b?style=for-the-badge&logo=vercel&logoColor=white)](https://greencart-frontend1.vercel.app)

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express%205-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%209-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Payments-635BFF?style=flat-square&logo=stripe&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-Images-3448C5?style=flat-square&logo=cloudinary&logoColor=white)

[Features](#-features) •
[Screenshots](#-screenshots) •
[Tech stack](#-tech-stack) •
[Getting started](#-getting-started) •
[Order lifecycle](#-order-lifecycle) •
[API](#-api-reference) •
[Deployment](#-deployment)

</div>

---

## ✨ Features

### 🛒 For customers

| | |
|---|---|
| 🥦 **Shop by category** | Vegetables, fruits, drinks, instant food, dairy, bakery and grains, plus search |
| 🧺 **Smart cart** | Saved to your account and synced across devices; works as a guest too |
| 📍 **Address book** | Add, edit and delete delivery addresses |
| 💳 **Two ways to pay** | Cash on Delivery, or card payment through Stripe Checkout |
| 📦 **Live order tracking** | Arrival countdown, step-by-step timeline with times, delivery partner with a call button |
| 🔔 **Order notifications** | A pop-up on any page when an order is confirmed, packed, out for delivery or delivered |
| ❌ **Cancel & refund** | Cancel until the order leaves the store; card payments are refunded automatically |
| 🔁 **Reorder & invoices** | Put a past order back in the cart in one click, or print its invoice |
| 🗂️ **Order history** | Filter orders by All / Active / Delivered / Cancelled |

### 🏪 For the seller

| | |
|---|---|
| ➕ **Product management** | Add products with up to 4 images (stored on Cloudinary) and toggle stock |
| ⚡ **Demo catalogue** | Load 35 ready-made products with images in one click |
| 🚚 **Order dispatch** | Move each order through Confirm → Pack → Out for delivery → Delivered, or let demo mode do it automatically |
| 🛵 **Delivery partners** | Assign a partner's name and phone when sending an order out |
| 🔔 **New-order alerts** | Pop-up as soon as a new order comes in |
| ↩️ **Cancellations** | Cancel with a reason the customer sees; paid orders are refunded |

### 🛡️ Under the hood

- **JWT authentication** for customers and the seller, sent as a Bearer token (with a cookie fallback)
- **Prices and tax calculated on the server**, never trusted from the browser
- **Payment double-checking**: payments are confirmed with Stripe when the customer returns,
  with the Stripe webhook as a backup, and the same order can never be charged twice
- **Order snapshots**: each order keeps its own copy of prices and address, so later edits don't change past orders
- **Health check** at `GET /` reporting whether the database and seller login are set up

---

## 📸 Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/home.png" alt="Home page" /><p align="center"><b>Home</b></p></td>
    <td width="50%"><img src="docs/screenshots/products.png" alt="All products" /><p align="center"><b>All products</b></p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/order-tracking.png" alt="Live order tracking" /><p align="center"><b>Live order tracking</b></p></td>
    <td width="50%" valign="top"><img src="docs/screenshots/seller-orders.png" alt="Seller order dashboard" /><p align="center"><b>Seller order dashboard</b></p></td>
  </tr>
</table>

---

## 🧰 Tech stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Vite 7, React Router 7, Tailwind CSS 4, Axios, React Hot Toast |
| **Backend** | Node.js, Express 5, Mongoose 9, JSON Web Tokens, bcryptjs, Multer |
| **Database** | MongoDB Atlas |
| **Payments** | Stripe Checkout (+ webhooks and refunds) |
| **Images** | Cloudinary |
| **Hosting** | Vercel (frontend and backend as separate projects) |

```mermaid
flowchart LR
    U([👤 Customer]) --> F[React frontend<br/>Vercel]
    S([🏪 Seller]) --> F
    F -- REST API + JWT --> B[Express backend<br/>Vercel serverless]
    B --> M[(MongoDB Atlas)]
    B --> C[Cloudinary<br/>product images]
    B <--> P[Stripe<br/>checkout & refunds]
    P -. webhook .-> B
```

---

## 📁 Project structure

```
greencart/
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── assets/             # Images, icons, categories and demo products
│   │   ├── components/         # Navbar, ProductCard, Login, Loading (payment return), ...
│   │   │   └── seller/         # Seller login
│   │   ├── context/            # AppContext: user, cart, products, API client, notifications
│   │   ├── pages/              # Home, AllProducts, ProductDetails, Cart, AddAddress,
│   │   │   │                   # MyOrders, OrderTracking, ...
│   │   │   └── seller/         # AddProduct, ProductList, Orders, SellerLayout
│   │   └── utils/              # Order status helpers (steps, badges, countdown)
│   ├── .env.example
│   └── vercel.json
├── server/                     # Express backend
│   ├── configs/                # MongoDB, Cloudinary and Multer setup
│   ├── controllers/            # Users, seller, products, cart, addresses, orders
│   ├── middlewares/            # authUser, authSeller (JWT)
│   ├── models/                 # User, Product, Address, Order
│   ├── routes/                 # /api/* routers
│   ├── server.js               # App entry: middleware, routes, health check
│   ├── .env.example
│   └── vercel.json
└── docs/screenshots/           # Images used in this README
```

---

## 🚀 Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or newer
- A free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- A [Cloudinary](https://cloudinary.com/) account (for product images)
- A [Stripe](https://stripe.com/) account in **test mode** (for card payments)

### 1. Clone the repository

```bash
git clone https://github.com/likith1231/greencart.git
cd greencart
```

### 2. Set up the backend

```bash
cd server
npm install
cp .env.example .env      # then fill in your values (see below)
npm run server            # starts on http://localhost:4000 with auto-reload
```

<details>
<summary><b>📝 Backend environment variables</b> (<code>server/.env</code>)</summary>

| Variable | What it is | Where to get it |
|---|---|---|
| `MONGODB_URI` | Database connection string, e.g. `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/test` | Atlas → **Connect** → **Drivers** |
| `JWT_SECRET` | Any long random text used to sign logins | Make one up |
| `NODE_ENV` | `development` locally, `production` when deployed | — |
| `SELLER_EMAIL` | Email for the seller login | Your choice |
| `SELLER_PASSWORD` | Password for the seller login | Your choice |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | Cloudinary dashboard |
| `CLOUDINARY_API_KEY` | Cloudinary API key | Cloudinary → Settings → **API Keys** |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Cloudinary → Settings → **API Keys** |
| `STRIPE_PUBLISHABLE_KEY` | Starts with `pk_test_` | Stripe → Developers → **API keys** |
| `STRIPE_SECRET_KEY` | Starts with `sk_test_` | Stripe → Developers → **API keys** |
| `STRIPE_WEBHOOK_SECRET` | Starts with `whsec_` | Stripe → Developers → **Webhooks** (see [Deployment](#-deployment)) |
| `AUTO_PROGRESS_ORDERS` | *Optional.* Orders move through their steps automatically (demo mode). Set to `false` for a real store | Defaults to on |

> 💡 The MongoDB password is the **database user's** password from Atlas → Database Access.
> It has nothing to do with the seller password.

</details>

### 3. Set up the frontend

```bash
cd ../client
npm install
cp .env.example .env      # VITE_BACKEND_URL=http://localhost:4000
npm run dev               # opens on http://localhost:5173
```

<details>
<summary><b>📝 Frontend environment variables</b> (<code>client/.env</code>)</summary>

| Variable | What it is | Example |
|---|---|---|
| `VITE_BACKEND_URL` | Address of the backend, no trailing `/` | `http://localhost:4000` |
| `VITE_CURRENCY` | Currency symbol shown in prices | `$` |

</details>

### 4. Add products

1. Open **http://localhost:5173/seller** and log in with `SELLER_EMAIL` / `SELLER_PASSWORD`
2. Go to **Product List** and click **Load demo products** to add 35 products at once,
   or use **Add Product** to create your own

### 5. Try card payments

Choose **Online Payment** in the cart and pay with Stripe's test card:

| Card number | Expiry | CVC |
|---|---|---|
| `4242 4242 4242 4242` | any future date | any 3 digits |

### Available scripts

| Folder | Command | What it does |
|---|---|---|
| `server` | `npm run server` | Start the API with auto-reload (nodemon) |
| `server` | `npm start` | Start the API |
| `client` | `npm run dev` | Start the frontend dev server |
| `client` | `npm run build` | Build the frontend for production |
| `client` | `npm run lint` | Check the code with ESLint |
| `client` | `npm run preview` | Preview the production build |

---

## 📦 Order lifecycle

Every order moves forward one step at a time, and the customer's tracking page and notifications update on their own.

> ⚡ **Demo mode (on by default):** orders progress automatically, like a real store working on them —
> **Confirmed** after 1 min, **Packed** after 4, **Out for Delivery** after 8 (a delivery partner is assigned),
> **Delivered** after 27. The seller can still move orders faster or cancel them from **Seller → Orders**.
> Set `AUTO_PROGRESS_ORDERS=false` on the backend to have the seller do every step by hand.

```mermaid
stateDiagram-v2
    direction LR
    [*] --> OrderPlaced: Customer places order
    OrderPlaced --> Confirmed: 1 min / seller confirms
    Confirmed --> Packed: 4 min / seller packs
    Packed --> OutForDelivery: 8 min / partner assigned
    OutForDelivery --> Delivered: 27 min / seller marks delivered
    Delivered --> [*]

    OrderPlaced --> Cancelled
    Confirmed --> Cancelled
    Packed --> Cancelled
    OutForDelivery --> Cancelled: Seller only
    Cancelled --> [*]

    OrderPlaced: Order Placed
    OutForDelivery: Out for Delivery
```

| Rule | Details |
|---|---|
| ⏱️ **Delivery promise** | 30 minutes from placing the order (or from paying, for card orders) |
| ❌ **Customer cancellation** | Allowed until the order is out for delivery |
| 💸 **Refunds** | Paid card orders are refunded through Stripe automatically when cancelled |
| 💵 **Cash on Delivery** | Marked as paid when the order is delivered |
| 🔁 **No double payments** | A new card checkout closes earlier unpaid ones, and an order is never charged twice |

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant F as Frontend
    participant B as Backend
    participant S as Stripe
    C->>F: Proceed to checkout
    F->>B: POST /api/order/stripe
    B->>S: Create Checkout session
    B-->>F: Checkout URL
    F->>S: Redirect to Stripe
    C->>S: Pay with card
    S-->>F: Return to /loader?session_id=…
    F->>B: POST /api/order/verify
    B->>S: Retrieve session (paid?)
    B-->>F: Paid ✅ (order marked paid, cart emptied)
    F-->>C: Opens the order's tracking page
    S--)B: Webhook (backup confirmation)
```

---

## 🔌 API reference

Base URL: `http://localhost:4000` locally, or your deployed backend.
🔒 = needs a customer token, 🏪 = needs the seller token (`Authorization: Bearer <token>`).

<details>
<summary><b>👤 Users</b> — <code>/api/user</code></summary>

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/user/register` | | Create an account (`name`, `email`, `password`) |
| `POST` | `/api/user/login` | | Log in (`email`, `password`) and get a token |
| `GET` | `/api/user/is-auth` | 🔒 | Current user, including the saved cart |
| `GET` | `/api/user/logout` | | Log out |

</details>

<details>
<summary><b>🏪 Seller</b> — <code>/api/seller</code></summary>

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/seller/login` | | Log in with `SELLER_EMAIL` / `SELLER_PASSWORD` |
| `GET` | `/api/seller/is-auth` | 🏪 | Check the seller session |
| `GET` | `/api/seller/logout` | | Log out |

</details>

<details>
<summary><b>🥕 Products</b> — <code>/api/product</code></summary>

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/product/list` | | All products |
| `GET` | `/api/product/id?id=…` | | One product |
| `POST` | `/api/product/add` | 🏪 | Add a product (multipart: `productData` + `images`) |
| `POST` | `/api/product/bulk-add` | 🏪 | Add many products at once (skips existing names) |
| `POST` | `/api/product/stock` | 🏪 | Set `isStock` for a product |

</details>

<details>
<summary><b>🧺 Cart & addresses</b> — <code>/api/cart</code>, <code>/api/address</code></summary>

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/cart/update` | 🔒 | Save the cart (`cartItems`) |
| `POST` | `/api/address/add` | 🔒 | Add an address |
| `GET` | `/api/address/get` | 🔒 | List your addresses |
| `POST` | `/api/address/update` | 🔒 | Edit an address (`id`, `address`) |
| `POST` | `/api/address/delete` | 🔒 | Delete an address (`id`) |

</details>

<details>
<summary><b>📦 Orders</b> — <code>/api/order</code></summary>

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/order/cod` | 🔒 | Place a Cash on Delivery order (`items`, `address`) |
| `POST` | `/api/order/stripe` | 🔒 | Start a card checkout; returns the Stripe URL |
| `POST` | `/api/order/pay` | 🔒 | Pay online for one of your unpaid orders (`orderId`) |
| `POST` | `/api/order/verify` | 🔒 | Confirm a payment after returning from Stripe (`sessionId`) |
| `GET` | `/api/order/user` | 🔒 | Your orders |
| `GET` | `/api/order/details?id=…` | 🔒 | One of your orders, for the tracking page |
| `GET` | `/api/order/updates` | 🔒 | Status of your recent orders (used for notifications) |
| `POST` | `/api/order/cancel` | 🔒 | Cancel your order (`orderId`, `reason`) |
| `GET` | `/api/order/seller` | 🏪 | All paid and Cash on Delivery orders |
| `POST` | `/api/order/status` | 🏪 | Move an order to its next step or cancel it (`orderId`, `status`, `deliveryPartner`, `reason`) |

</details>

<details>
<summary><b>🩺 Other</b></summary>

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Health check: database status, whether seller login is configured, and whether demo mode is on |
| `POST` | `/stripe` | Stripe webhook (signed by Stripe) |

</details>

---

## ☁️ Deployment

The app is deployed on **Vercel** as two projects from this repository:

| Vercel project | Root directory | Live URL |
|---|---|---|
| **greencart-frontend1** | `client` | https://greencart-frontend1.vercel.app |
| **greencart** (backend) | `server` | https://greencart-gilt-phi.vercel.app |

1. **Backend project** → Settings → Environment Variables: add every variable from
   [`server/.env.example`](server/.env.example) and set `NODE_ENV=production`
2. **Frontend project** → Settings → Environment Variables: set
   `VITE_BACKEND_URL` to the backend URL and `VITE_CURRENCY`
3. **MongoDB Atlas** → Network Access: allow `0.0.0.0/0`, because Vercel's servers don't have fixed IP addresses
4. **Stripe** → Developers → Webhooks → Add endpoint:
   - URL: `https://<your-backend>.vercel.app/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`
5. If your frontend has a different domain, add it to `allowOrigins` in [`server/server.js`](server/server.js)
6. After changing any variable, **Redeploy** the project, because variables only apply to new deployments

> ✅ Check the backend by opening its URL: it should show
> `"database": "connected"` and `"sellerLoginConfigured": true`.

---

## 🩹 Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `bad auth : authentication failed` | Wrong username or password in `MONGODB_URI`. Reset the user's password in Atlas → Database Access, then update the variable and redeploy |
| `querySrv ENOTFOUND` or timeouts | Atlas is blocking the server. Add `0.0.0.0/0` in Atlas → Network Access |
| Seller login says *not set up* | `SELLER_EMAIL` or `SELLER_PASSWORD` is missing or misspelled on the backend project |
| Card payment stays *Payment pending* | Stripe keys are from a different account, or the webhook isn't set up |
| Product images don't upload | Check the three `CLOUDINARY_*` variables |
| Changes in Vercel don't apply | Redeploy after editing environment variables |

---

## 🔐 Security notes

- Never commit `.env` files. They're listed in [`.gitignore`](.gitignore); share settings through `.env.example` only
- Use Stripe **test** keys while developing
- If a secret was ever committed, change it (database password, `JWT_SECRET`, API keys) and consider making the repository private

---

<div align="center">

Made with 💚 by <a href="https://github.com/likith1231">Likith</a>

⭐ If you like this project, give it a star!

</div>
