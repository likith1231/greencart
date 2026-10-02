import Order, { CANCELLED, DELIVERY_MINUTES, ORDER_STEPS } from "../models/Order.js"
import Product from "../models/product.js";
import stripe from "stripe";
import User from "../models/User.js";
import Address from "../models/Address.js";


// Round to whole cents
const toCents = (value) => Math.round(value * 100) / 100;

// Look up every ordered product, the user's delivery address and the order total.
// Tax is 2% rounded down to the cent, the same way the cart page shows it.
const buildOrder = async (userId, items, addressId) => {
    if (!addressId || !Array.isArray(items) || items.length === 0) {
        throw new Error("Invalid data");
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
        throw new Error("Please select a valid delivery address");
    }

    let subtotal = 0;
    const orderItems = [];
    const productData = [];

    for (const item of items) {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
            throw new Error("Invalid quantity");
        }
        const product = await Product.findById(item.product);
        if (!product) {
            throw new Error("Some products in your cart are no longer available");
        }
        orderItems.push({ product: item.product, quantity, price: product.offerPrice });
        productData.push({ name: product.name, price: product.offerPrice, quantity });
        subtotal += product.offerPrice * quantity;
    }

    subtotal = toCents(subtotal);
    const tax = Math.floor(subtotal * 0.02 * 100) / 100;

    return {
        orderFields: {
            userId,
            items: orderItems,
            subtotal,
            tax,
            amount: toCents(subtotal + tax),
            address: addressId,
            shippingAddress: address.toObject(),
        },
        productData,
        tax,
    };
};

const minutesFromNow = (minutes) => new Date(Date.now() + minutes * 60 * 1000);

// Fields every new order starts with: first step of the timeline and the promised delivery time
const newOrderTracking = () => ({
    status: ORDER_STEPS[0],
    statusHistory: [{ status: ORDER_STEPS[0], at: new Date() }],
    estimatedDeliveryAt: minutesFromNow(DELIVERY_MINUTES),
});

const getStripe = () => new stripe(process.env.STRIPE_SECRET_KEY);

//Place Order COD: /api/order/cod
export const placeOrderCOD = async (req, res) => {
    try {
        const userId = req.userId;
        const { items, address } = req.body;

        const { orderFields } = await buildOrder(userId, items, address);

        const order = await Order.create({ ...orderFields, ...newOrderTracking(), paymentType: "COD", isPaid: false });

        await User.findByIdAndUpdate(userId, { cartItems: {} });

        return res.json({ success: true, message: "Order Placed Successfully", orderId: order._id });
    } catch (error) {
        console.log("error ordering product : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

// Create a Stripe Checkout page for an order and return the session
const createCheckoutSession = async ({ productData, tax, origin, cancelPath, metadata }) => {
    // Stripe expects integer amounts in cents
    const line_items = productData.map((item) => ({
        price_data: {
            currency: "usd",
            product_data: { name: item.name },
            unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
    }));

    if (tax > 0) {
        line_items.push({
            price_data: {
                currency: "usd",
                product_data: { name: "Tax (2%)" },
                unit_amount: Math.round(tax * 100),
            },
            quantity: 1,
        });
    }

    return getStripe().checkout.sessions.create({
        line_items,
        mode: "payment",
        // Stripe fills in {CHECKOUT_SESSION_ID}, so the return page can confirm the payment
        success_url: `${origin}/loader?next=my-orders&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${cancelPath}`,
        metadata,
    });
};

// Mark a Stripe-paid order as paid; shared by the return-page check, the webhook and the cleanup below
const markOrderPaid = async ({ orderId, userId, payLater }, paymentIntentId) => {
    const order = await Order.findById(orderId);
    if (!order) return;

    if (!order.isPaid) {
        const wasOnlineOrder = order.paymentType === "Online";
        order.isPaid = true;
        order.paymentType = "Online";
        if (paymentIntentId) order.paymentIntentId = paymentIntentId;

        // An online order really starts once it's paid: restart the delivery clock,
        // and revive it if it had been closed for not being paid
        if (order.status === CANCELLED && order.cancelledBy === "system") {
            order.status = ORDER_STEPS[0];
            order.cancelReason = undefined;
            order.cancelledBy = undefined;
            order.statusHistory.push({ status: ORDER_STEPS[0], at: new Date() });
        }
        if (wasOnlineOrder && order.status === ORDER_STEPS[0]) {
            order.estimatedDeliveryAt = minutesFromNow(DELIVERY_MINUTES);
        }
        await order.save();
    }

    // Paying later for a Cash on Delivery order must not empty the customer's current cart
    if (payLater !== "true") {
        await User.findByIdAndUpdate(userId, { cartItems: {} });
    }
};

// Before starting a new online checkout, settle the customer's earlier unpaid online orders,
// so the same items can't end up ordered (and paid) twice:
// paid ones are marked paid, the rest have their Stripe page closed and are cancelled.
const closeUnpaidOnlineOrders = async (userId) => {
    const pending = await Order.find({ userId, paymentType: "Online", isPaid: false, status: { $ne: CANCELLED } });

    for (const order of pending) {
        if (order.stripeSessionId) {
            try {
                const session = await getStripe().checkout.sessions.retrieve(order.stripeSessionId);
                if (session.payment_status === "paid") {
                    await markOrderPaid({ ...session.metadata, payLater: "true" }, session.payment_intent);
                    continue;
                }
                if (session.status === "open") {
                    await getStripe().checkout.sessions.expire(order.stripeSessionId);
                }
            } catch (error) {
                console.log("could not check old checkout : ", error.message);
            }
        }
        order.status = CANCELLED;
        order.cancelledBy = "system";
        order.cancelReason = "Payment not completed";
        order.statusHistory.push({ status: CANCELLED, at: new Date() });
        await order.save();
    }
};

//Place Order Stripe: /api/order/stripe
export const placeOrderStripe = async (req, res) => {
    try {
        const userId = req.userId;
        const { items, address } = req.body;
        const { origin } = req.headers;

        const { orderFields, productData, tax } = await buildOrder(userId, items, address);

        await closeUnpaidOnlineOrders(userId);

        // Saved only after Stripe accepts the session, so failed checkouts leave no stray orders
        const order = new Order({ ...orderFields, ...newOrderTracking(), paymentType: "Online", isPaid: false });

        const session = await createCheckoutSession({
            productData,
            tax,
            origin,
            cancelPath: "/cart",
            metadata: { orderId: order._id.toString(), userId },
        });

        order.stripeSessionId = session.id;
        await order.save();

        return res.json({ success: true, url: session.url });
    } catch (error) {
        console.log("error ordering product : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

//Pay online for one of the customer's unpaid orders: /api/order/pay
export const payExistingOrder = async (req, res) => {
    try {
        const userId = req.userId;
        const { orderId } = req.body;
        const { origin } = req.headers;

        const order = await Order.findOne({ _id: orderId, userId }).populate("items.product");

        if (!order) {
            return res.json({ success: false, message: "Order not found" });
        }
        if (order.isPaid) {
            return res.json({ success: false, message: "This order is already paid" });
        }
        if (order.status === CANCELLED) {
            return res.json({ success: false, message: "This order was cancelled" });
        }

        // If an earlier payment page for this order was completed, don't charge again
        if (order.stripeSessionId) {
            try {
                const previous = await getStripe().checkout.sessions.retrieve(order.stripeSessionId);
                if (previous.payment_status === "paid") {
                    await markOrderPaid({ ...previous.metadata, payLater: "true" }, previous.payment_intent);
                    return res.json({ success: false, message: "This order is already paid" });
                }
                if (previous.status === "open") {
                    await getStripe().checkout.sessions.expire(order.stripeSessionId);
                }
            } catch (error) {
                console.log("could not check previous checkout : ", error.message);
            }
        }

        // Older orders didn't save prices, so fall back to the product's current price
        const productData = order.items
            .filter((item) => item.product)
            .map((item) => ({
                name: item.product.name,
                price: item.price ?? item.product.offerPrice,
                quantity: item.quantity,
            }));

        if (productData.length === 0) {
            return res.json({ success: false, message: "The products in this order are no longer available" });
        }

        const subtotal = productData.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const tax = order.tax ?? Math.max(toCents(order.amount - subtotal), 0);

        const session = await createCheckoutSession({
            productData,
            tax,
            origin,
            cancelPath: `/my-orders/${order._id}`,
            // payLater keeps a Cash on Delivery order (and the customer's current cart) untouched.
            // A pending online order came from the cart, so it clears it as usual.
            metadata: { orderId: order._id.toString(), userId, payLater: order.paymentType === "COD" ? "true" : "false" },
        });

        order.stripeSessionId = session.id;
        await order.save();

        return res.json({ success: true, url: session.url });
    } catch (error) {
        console.log("error paying for order : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

//Confirm a Stripe payment when the customer returns from checkout: /api/order/verify
// Works even if the Stripe webhook isn't set up
export const verifyStripePayment = async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.json({ success: false, message: "Missing payment session" });
        }

        const session = await getStripe().checkout.sessions.retrieve(sessionId);

        // Only the customer who placed the order can confirm it
        if (session.metadata?.userId !== req.userId) {
            return res.json({ success: false, message: "Payment not found" });
        }

        if (session.payment_status !== "paid") {
            return res.json({ success: true, paid: false, message: "Payment not completed" });
        }

        await markOrderPaid(session.metadata, session.payment_intent);

        return res.json({
            success: true,
            paid: true,
            payLater: session.metadata.payLater === "true",
            orderId: session.metadata.orderId,
            message: "Payment successful",
        });
    } catch (error) {
        console.log("error verifying payment : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

// Cancel an order and refund it if it was paid online
const cancelOrder = async (order, { by, reason }) => {
    order.status = CANCELLED;
    order.cancelledBy = by;
    order.cancelReason = reason || "No reason given";
    order.statusHistory.push({ status: CANCELLED, at: new Date() });

    let refundMessage = "";
    if (order.isPaid && order.paymentType === "Online") {
        try {
            let paymentIntentId = order.paymentIntentId;
            if (!paymentIntentId && order.stripeSessionId) {
                paymentIntentId = (await getStripe().checkout.sessions.retrieve(order.stripeSessionId)).payment_intent;
            }
            if (!paymentIntentId) throw new Error("payment reference missing");
            await getStripe().refunds.create({ payment_intent: paymentIntentId });
            order.paymentIntentId = paymentIntentId;
            order.refundStatus = "refunded";
            refundMessage = " Your refund has been sent to your card.";
        } catch (error) {
            console.log("refund failed : ", error.message);
            order.refundStatus = "pending";
            refundMessage = " Your refund will be processed by the store.";
        }
    }

    await order.save();
    return refundMessage;
};

// Customers can cancel until the order leaves the store
const CUSTOMER_CANCELLABLE = ["Order Placed", "Confirmed", "Packed"];

//Cancel an order (customer) : /api/order/cancel
export const cancelOrderByUser = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        const order = await Order.findOne({ _id: orderId, userId: req.userId });

        if (!order) {
            return res.json({ success: false, message: "Order not found" });
        }
        if (!CUSTOMER_CANCELLABLE.includes(order.status)) {
            return res.json({ success: false, message: `This order can't be cancelled because it is ${order.status.toLowerCase()}` });
        }

        const refundMessage = await cancelOrder(order, { by: "customer", reason });
        return res.json({ success: true, message: `Order cancelled.${refundMessage}` });
    } catch (error) {
        console.log("error cancelling order : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

//Move an order to its next step, or cancel it (seller) : /api/order/status
export const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status, reason, deliveryPartner } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.json({ success: false, message: "Order not found" });
        }
        if (order.status === CANCELLED || order.status === "Delivered") {
            return res.json({ success: false, message: `This order is already ${order.status.toLowerCase()}` });
        }
        if (order.paymentType === "Online" && !order.isPaid) {
            return res.json({ success: false, message: "This order hasn't been paid yet" });
        }

        if (status === CANCELLED) {
            const refundMessage = await cancelOrder(order, { by: "seller", reason });
            return res.json({ success: true, message: `Order cancelled.${refundMessage}` });
        }

        // Orders move forward one step at a time
        const nextStatus = ORDER_STEPS[ORDER_STEPS.indexOf(order.status) + 1];
        if (status !== nextStatus) {
            return res.json({ success: false, message: `Next step for this order is "${nextStatus}"` });
        }

        if (status === "Out for Delivery") {
            const name = deliveryPartner?.name?.trim();
            const phone = deliveryPartner?.phone?.trim();
            if (!name || !phone) {
                return res.json({ success: false, message: "Enter the delivery partner's name and phone number" });
            }
            order.deliveryPartner = { name, phone };
        }

        if (status === "Delivered") {
            order.deliveredAt = new Date();
            // Cash on Delivery is paid when the order is handed over
            if (order.paymentType === "COD") order.isPaid = true;
        }

        order.status = status;
        order.statusHistory.push({ status, at: new Date() });
        await order.save();

        return res.json({ success: true, message: `Order marked as ${status}` });
    } catch (error) {
        console.log("error updating order : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

//Stripe Webhooks to verify payments: /stripe
export const stripeWebhooks = async (request, response) => {
    const stripeInstance = getStripe();

    const sig = request.headers["stripe-signature"];
    let event;

    try {
        event = stripeInstance.webhooks.constructEvent(
            request.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        return response.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        switch (event.type) {
            case "payment_intent.succeeded": {
                const paymentIntentId = event.data.object.id;

                const session = await stripeInstance.checkout.sessions.list({
                    payment_intent: paymentIntentId,
                });

                await markOrderPaid(session.data[0].metadata, paymentIntentId);
                break;
            }
            case "payment_intent.payment_failed":
                // The customer can retry on the same Stripe page, so the order is kept as unpaid
                break;
            default:
                console.log(`Unhandled event type ${event.type}`);
                break;
        }
    } catch (error) {
        console.log("stripe webhook error : ", error.message);
        return response.status(500).send(`Webhook Error: ${error.message}`);
    }

    response.json({ received: true });
};

// Order responses include serverTime so the site's countdown doesn't depend on the
// customer's device clock being right

//Get Orders by User ID : /api/order/user
export const getUserOrders = async (req, res) => {
    try {
        // Includes unpaid online orders, so customers can see them and finish paying
        const orders = await Order.find({ userId: req.userId }).populate("items.product address").sort({createdAt: -1});

        res.json({ success: true, orders, serverTime: Date.now() });
    } catch(error) {
        res.json({ success:false, message: error.message });
    }
};

//Get one of the customer's orders, for the tracking page : /api/order/details?id=
export const getOrderDetails = async (req, res) => {
    try {
        const order = await Order.findOne({ _id: req.query.id, userId: req.userId }).populate("items.product address");

        if (!order) {
            return res.json({ success: false, message: "Order not found" });
        }
        res.json({ success: true, order, serverTime: Date.now() });
    } catch(error) {
        res.json({ success:false, message: error.message });
    }
};

//Status of the customer's orders, polled by the site to show update notifications : /api/order/updates
export const getOrderUpdates = async (req, res) => {
    try {
        const orders = await Order.find({ userId: req.userId }, { status: 1, isPaid: 1, cancelledBy: 1 }).sort({ createdAt: -1 }).limit(20);
        res.json({ success: true, orders });
    } catch(error) {
        res.json({ success:false, message: error.message });
    }
};

//Get All Orders ( for seller / admin ) : /api/order/seller
export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            $or: [ {paymentType: "COD"}, {isPaid: true} ]
        }).populate("items.product address").sort({createdAt: -1});
        res.json({ success: true, orders });
    } catch(error) {
        res.json({ success:false, message: error.message });
    }
};
