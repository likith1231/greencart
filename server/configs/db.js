import mongoose from "mongoose";

// Fail fast instead of waiting 10s when the database isn't connected
mongoose.set("bufferCommands", false);

// Last connection error, shown by the health check at GET /
export let dbError = null;

let connecting = null;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) return;

    // Reuse an in-flight attempt so parallel requests don't open several connections
    if (!connecting) {
        connecting = mongoose
            .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 })
            .then(() => {
                dbError = null;
                console.log("Database connected");
            })
            .catch((error) => {
                dbError = error.message;
                console.error("Database connection failed:", error.message);
            })
            .finally(() => {
                connecting = null;
            });
    }
    await connecting;
}

export default connectDB;
