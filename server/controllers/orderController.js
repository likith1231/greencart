import Order from "../models/Order.js"
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

//Place Order COD: /api/order/cod
export const placeOrderCOD = async (req, res) => {
    try {
        const userId = req.userId;
        const { items, address } = req.body;

        const { orderFields } = await buildOrder(userId, items, address);

        await Order.create({ ...orderFields, paymentType: "COD", isPaid: false });

        await User.findByIdAndUpdate(userId, { cartItems: {} });

        return res.json({ success: true, message: "Order Placed Successfully" });
    } catch (error) {
        console.log("error ordering product : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

// Create a Stripe Checkout page for an order and return the session
const createCheckoutSession = async ({ productData, tax, origin, cancelPath, metadata }) => {
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

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

    return stripeInstance.checkout.sessions.create({
        line_items,
        mode: "payment",
        // Stripe fills in {CHECKOUT_SESSION_ID}, so the return page can confirm the payment
        success_url: `${origin}/loader?next=my-orders&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${cancelPath}`,
        metadata,
    });
};

//Place Order Stripe: /api/order/stripe
export const placeOrderStripe = async (req, res) => {
    try {
        const userId = req.userId;
        const { items, address } = req.body;
        const { origin } = req.headers;

        const { orderFields, productData, tax } = await buildOrder(userId, items, address);

        // Saved only after Stripe accepts the session, so failed checkouts leave no stray orders
        const order = new Order({ ...orderFields, paymentType: "Online", isPaid: false });

        const session = await createCheckoutSession({
            productData,
            tax,
            origin,
            cancelPath: "/cart",
            metadata: { orderId: order._id.toString(), userId },
        });

        await order.save();

        return res.json({ success: true, url: session.url });
    } catch (error) {
        console.log("error ordering product : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

//Pay online for an existing unpaid (Cash on Delivery) order: /api/order/pay
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
            cancelPath: "/my-orders",
            // payLater tells the webhook not to clear the cart or delete the order on failure
            metadata: { orderId: order._id.toString(), userId, payLater: "true" },
        });

        return res.json({ success: true, url: session.url });
    } catch (error) {
        console.log("error paying for order : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

// Mark a Stripe-paid order as paid; shared by the return-page check and the webhook
const markOrderPaid = async ({ orderId, userId, payLater }) => {
    await Order.findByIdAndUpdate(orderId, { isPaid: true, paymentType: "Online" });

    // Paying later for an old order must not empty the customer's current cart
    if (payLater !== "true") {
        await User.findByIdAndUpdate(userId, { cartItems: {} });
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

        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);
        const session = await stripeInstance.checkout.sessions.retrieve(sessionId);

        // Only the customer who placed the order can confirm it
        if (session.metadata?.userId !== req.userId) {
            return res.json({ success: false, message: "Payment not found" });
        }

        if (session.payment_status !== "paid") {
            return res.json({ success: true, paid: false, message: "Payment not completed" });
        }

        await markOrderPaid(session.metadata);

        return res.json({ success: true, paid: true, payLater: session.metadata.payLater === "true", message: "Payment successful" });
    } catch (error) {
        console.log("error verifying payment : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

//Stripe Webhooks to verify payments: /stripe
export const stripeWebhooks = async (request, response) => {
    const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

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

                await markOrderPaid(session.data[0].metadata);
                break;
            }
            case "payment_intent.payment_failed": {
                const paymentIntentId = event.data.object.id;

                const session = await stripeInstance.checkout.sessions.list({
                    payment_intent: paymentIntentId,
                });

                const { orderId, payLater } = session.data[0].metadata;

                // A failed later payment keeps the Cash on Delivery order as it was
                if (payLater !== "true") {
                    await Order.findByIdAndDelete(orderId);
                }
                break;
            }
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

//Get Orders by User ID : /api/order/user
export const getUserOrders = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.json({ success: false, message: "User not authenticated" });
        }
        
        // Includes unpaid online orders, so customers can see them and finish paying
        const orders = await Order.find({ userId }).populate("items.product address").sort({createdAt: -1});

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
