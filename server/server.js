import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import "dotenv/config"
import mongoose from "mongoose";
import connectDB, { dbError } from "./configs/db.js";
import { autoProgressEnabled } from "./utils/autoProgress.js";
import userRouter from "./routes/userRoute.js";
import sellerRouter from "./routes/sellerRoute.js";
import connectCloudinary from "./configs/cloudinary.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import addressRouter from "./routes/addressRoute.js";
import orderRouter from "./routes/orderRoute.js";
import { stripeWebhooks } from "./controllers/orderController.js";

// Values pasted into a hosting dashboard (e.g. Vercel) often keep the quotes and
// spaces from the .env file, which breaks the database URL and the seller login
for (const [key, value] of Object.entries(process.env)) {
  process.env[key] = value.trim().replace(/^(['"])(.*)\1$/, "$2");
}

// Summarise MONGODB_URI for the health check: everything except the password itself
const describeMongoUri = (uri) => {
  const match = /^(mongodb(?:\+srv)?):\/\/([^:@/]*)(?::(.*))?@([^@/?]+)\/?([^?]*)/.exec(uri || "");
  if (!match) return { valid: false, hint: "MONGODB_URI is missing or not in the form mongodb+srv://user:password@host/database" };
  const [, scheme, user, password = "", host, database] = match;
  return {
    scheme,
    user,
    host,
    database: database || "(none, defaults to test)",
    passwordLength: password.length,
    passwordHasAngleBrackets: /[<>]/.test(password),
    passwordHasSpecialCharacters: /[^A-Za-z0-9%]/.test(password),
  };
};

const app = express();
const port = process.env.PORT || 4000;

await connectDB();
await connectCloudinary()

const allowOrigins = ['http://localhost:5173', 'http://localhost:5174', 'https://greencart-frontend1.vercel.app']

app.post('/stripe', express.raw({type: 'application/json'}), async (req, res, next) => {
  await connectDB();
  next();
}, stripeWebhooks)

//Middleware configuration
app.use(express.json());
app.use(cookieParser());
app.use(cors({origin: allowOrigins, credentials: true}));

// Health check: shows whether the database is reachable and, if not, why
app.get('/', async (req, res) => {
  await connectDB();
  res.json({
    api: 'working',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'not connected',
    databaseError: dbError,
    sellerLoginConfigured: Boolean(process.env.SELLER_EMAIL && process.env.SELLER_PASSWORD),
    autoProgressOrders: autoProgressEnabled(),
    // Only shown while disconnected, to spot typos in MONGODB_URI without revealing the password
    ...(mongoose.connection.readyState !== 1 && { connectionInfo: describeMongoUri(process.env.MONGODB_URI) }),
  });
});

// Seller login only checks the .env credentials, so it works without the database
app.use('/api/seller', sellerRouter);

// Reconnect on each request if the database connection was lost or never made
app.use(async (req, res, next) => {
  await connectDB();
  if (mongoose.connection.readyState !== 1) {
    return res.json({ success: false, message: `Database not connected: ${dbError || 'unknown error'}` });
  }
  next();
});

app.use('/api/user', userRouter);
app.use('/api/product', productRouter);
app.use('/api/cart', cartRouter);
app.use('/api/address', addressRouter);
app.use('/api/order', orderRouter);

// On Vercel the app is invoked as a serverless function, so only listen locally
if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`server is running on http://localhost:${port}`);
  });
}

export default app;
