import Order, { CANCELLED, DELIVERY_MINUTES } from "../models/Order.js";

// Demo mode: orders move through their steps on their own, like a real store working on them.
// Turn it off for a real store by setting AUTO_PROGRESS_ORDERS=false on the server.
export const autoProgressEnabled = () => process.env.AUTO_PROGRESS_ORDERS !== "false";

// Minutes after the order starts (placed, or paid for card orders) when each step happens
const SCHEDULE = [
    { status: "Confirmed", after: 1 },
    { status: "Packed", after: 4 },
    { status: "Out for Delivery", after: 8 },
    { status: "Delivered", after: DELIVERY_MINUTES - 3 },
];

const DELIVERY_PARTNERS = ["Ravi Kumar", "Arjun Singh", "Imran Khan", "Suresh Patel", "Vikram Rao", "Anil Sharma"];

// Same partner every time for the same order
const partnerFor = (orderId) => {
    const sum = String(orderId).split("").reduce((total, char) => total + char.charCodeAt(0), 0);
    return DELIVERY_PARTNERS[sum % DELIVERY_PARTNERS.length];
};

// Bring one order up to date: add every step whose time has passed, stamped with the time it was due.
// Servers on Vercel can't run background timers, so this runs whenever orders are loaded.
const progressOrder = async (order) => {
    if (!order.estimatedDeliveryAt) return; // placed before tracking existed

    const startedAt = new Date(order.estimatedDeliveryAt).getTime() - DELIVERY_MINUTES * 60 * 1000;
    const now = Date.now();
    const currentIndex = SCHEDULE.findIndex((step) => step.status === order.status);

    const dueSteps = SCHEDULE
        .slice(currentIndex + 1)
        .map((step) => ({ status: step.status, at: new Date(startedAt + step.after * 60 * 1000) }))
        .filter((step) => step.at.getTime() <= now);

    if (dueSteps.length === 0) return;

    // A step the seller already did by hand can be later than the schedule; never go back in time
    const lastStepAt = order.statusHistory?.length ? new Date(order.statusHistory.at(-1).at).getTime() : 0;
    for (const step of dueSteps) {
        if (step.at.getTime() < lastStepAt) step.at = new Date(lastStepAt);
    }

    const finalStatus = dueSteps.at(-1).status;
    const update = { status: finalStatus };

    if (dueSteps.some((step) => step.status === "Out for Delivery") && !order.deliveryPartner?.name) {
        // No phone number: it's a demo partner, so there's no one to call
        update.deliveryPartner = { name: partnerFor(order._id), phone: "" };
    }
    if (finalStatus === "Delivered") {
        update.deliveredAt = dueSteps.at(-1).at;
        if (order.paymentType === "COD") update.isPaid = true;
    }

    // Only applies if nobody changed the order in the meantime (e.g. the seller, or another request)
    await Order.updateOne(
        { _id: order._id, status: order.status },
        { $set: update, $push: { statusHistory: { $each: dueSteps } } }
    );
};

// Bring the matching active orders up to date before they are read
export const autoProgressOrders = async (filter = {}) => {
    if (!autoProgressEnabled()) return;

    const active = await Order.find({
        ...filter,
        status: { $nin: ["Delivered", CANCELLED] },
        estimatedDeliveryAt: { $exists: true },
        $or: [{ paymentType: "COD" }, { isPaid: true }],
    });

    for (const order of active) {
        try {
            await progressOrder(order);
        } catch (error) {
            console.log("could not update order progress : ", error.message);
        }
    }
};
