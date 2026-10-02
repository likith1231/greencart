import mongoose from "mongoose";

// The steps an order moves through, in order. "Cancelled" can happen before "Delivered".
export const ORDER_STEPS = ["Order Placed", "Confirmed", "Packed", "Out for Delivery", "Delivered"];
export const CANCELLED = "Cancelled";

// Promised delivery time after an order is placed (or paid)
export const DELIVERY_MINUTES = 30;

const orderSchema = new mongoose.Schema({
    userId: { type: String, required: true, ref: 'users' },
    items: [{
        product: { type: String, required: true, ref: 'products' },
        quantity: { type: Number, required: true },
        // Price per item when the order was placed (older orders don't have it)
        price: { type: Number },
    }],
    subtotal: { type: Number },
    tax: { type: Number },
    amount: { type: Number, required: true },
    address: { type: String, required: true, ref: 'address' },
    // Copy of the address at order time, so editing or deleting an address later doesn't change past orders
    shippingAddress: { type: Object },
    status: { type: String, default: "Order Placed" },
    // Every status change with its time, for the tracking timeline
    statusHistory: [{
        status: { type: String, required: true },
        at: { type: Date, default: Date.now },
        _id: false,
    }],
    estimatedDeliveryAt: { type: Date },
    deliveredAt: { type: Date },
    deliveryPartner: {
        name: { type: String },
        phone: { type: String },
    },
    cancelReason: { type: String },
    cancelledBy: { type: String }, // "customer", "seller" or "system"
    paymentType: { type: String, required: true },
    isPaid: { type: Boolean, required: true, default: false },
    // Stripe references, used to avoid double payments and to refund cancelled orders
    stripeSessionId: { type: String },
    paymentIntentId: { type: String },
    refundStatus: { type: String }, // "refunded" or "pending"
}, { timestamps: true });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;
