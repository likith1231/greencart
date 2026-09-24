import mongoose from "mongoose";

// Reuse one connection across requests (important on Vercel, where the
// module stays loaded between invocations of a warm serverless function)
let connectionPromise = null;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is not set. Add it to server/.env (or the Vercel project's Environment Variables).");
    }

    if (!connectionPromise) {
        mongoose.connection.on('connected', () => console.log("Database connected"));
        connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
            // Fail fast with the real reason instead of queries silently
            // buffering until "buffering timed out after 10000ms"
            serverSelectionTimeoutMS: 8000,
        }).catch((error) => {
            // Allow the next request to retry instead of caching the failure
            connectionPromise = null;
            throw error;
        });
    }

    await connectionPromise;
    return mongoose.connection;
}

export default connectDB;
