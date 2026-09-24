import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import "dotenv/config"
import connectDB from "./configs/db.js";
import userRouter from "./routes/userRoute.js";
import sellerRouter from "./routes/sellerRoute.js";
import connectCloudinary from "./configs/cloudinary.js";
import productRouter from "./routes/productRoute.js";
import cartRouter from "./routes/cartRoute.js";
import addressRouter from "./routes/addressRoute.js";
import orderRouter from "./routes/orderRoute.js";
import { stripeWebhooks } from "./controllers/orderController.js";

const app = express();
const port = process.env.PORT || 4000;

await connectCloudinary()

// Log a clear message at startup if the database is unreachable
connectDB().catch((error) => console.error("Database connection failed:", error.message));

const allowOrigins = ['http://localhost:5173', 'http://localhost:5174', 'https://greencart-frontend1.vercel.app']

// CORS first so browsers can read error responses too
app.use(cors({origin: allowOrigins, credentials: true}));

app.get('/', (req, res) => res.send('API is Working - Updated'));

// Make sure the database is connected before handling any request, and
// report the real reason (bad URI, IP not allowed in Atlas, ...) if it isn't
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection failed:", error.message);
    res.status(503).json({ success: false, message: `Database connection failed: ${error.message}` });
  }
});

app.post('/stripe', express.raw({type: 'application/json'}),stripeWebhooks)

//Middleware configuration
app.use(express.json());
app.use(cookieParser());

app.use('/api/user', userRouter);
app.use('/api/seller', sellerRouter);
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
