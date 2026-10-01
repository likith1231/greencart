import mongoose from "mongoose";

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
    paymentType: { type: String, required: true },
    isPaid: { type: Boolean, required: true, default: false }
}, { timestamps: true });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;