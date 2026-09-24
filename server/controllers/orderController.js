import Order from "../models/Order.js"
import Product from "../models/product.js";
import stripe from "stripe";
import User from "../models/User.js";


// Look up every ordered product and build the order total (including 2% tax)
const buildOrderItems = async (items) => {
    let amount = 0;
    const productData = [];

    for (const item of items) {
        const product = await Product.findById(item.product);
        if (!product) {
            throw new Error("Some products in your cart are no longer available");
        }
        productData.push({
            name: product.name,
            price: product.offerPrice,
            quantity: item.quantity,
        });
        amount += product.offerPrice * item.quantity;
    }

    //Add Tax Charge (2%)
    amount += Math.floor(amount * 0.02);

    return { amount, productData };
};

//Place Order COD: /api/order/cod
export const placeOrderCOD = async (req, res) => {
    try {
        const userId = req.userId;
        const { items, address } = req.body;

        if (!address || !Array.isArray(items) || items.length === 0) {
            return res.json({ success: false, message: "Invalid data"});
        }

        const { amount } = await buildOrderItems(items);

        await Order.create({
            userId,
            items,
            amount,
            address,
            paymentType: "COD",
            isPaid: false
        });

        await User.findByIdAndUpdate(userId, { cartItems: {} });

        return res.json({ success: true, message: "Order Placed Successfully" });
    } catch (error) {
        console.log("error ordering product : ", error.message);
        return res.json({ success: false, message: error.message });
    }
};

//Place Order Stripe: /api/order/stripe
export const placeOrderStripe = async (req, res) => {
    try {
        const userId = req.userId;
        const { items, address } = req.body;
        const { origin } = req.headers;

        if (!address || !Array.isArray(items) || items.length === 0) {
            return res.json({ success: false, message: "Invalid data"});
        }

        const { amount, productData } = await buildOrderItems(items);

        const order = await Order.create({
            userId,
            items,
            amount,
            address,
            paymentType: "Online",
            isPaid: false
        });

        const stripeInstance = new stripe(process.env.STRIPE_SECRET_KEY);

        const line_items = productData.map((item) => ({
            price_data: {
                currency: "usd",
                product_data: {
                    name: item.name,
                },
                // Stripe expects an integer amount in cents
                unit_amount: Math.round(item.price * 1.02 * 100),
            },
            quantity: item.quantity,
        }));

        const session = await stripeInstance.checkout.sessions.create({
            line_items,
            mode: "payment",
            success_url: `${origin}/loader?next=my-orders`,
            cancel_url: `${origin}/cart`,
            metadata: {
                orderId: order._id.toString(),
                userId,
            }
        });

        return res.json({ success: true, url: session.url });
    } catch (error) {
        console.log("error ordering product : ", error.message);
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

                const { orderId, userId } = session.data[0].metadata;

                await Order.findByIdAndUpdate(orderId, { isPaid: true });
                await User.findByIdAndUpdate(userId, { cartItems: {} });
                break;
            }
            case "payment_intent.payment_failed": {
                const paymentIntentId = event.data.object.id;

                const session = await stripeInstance.checkout.sessions.list({
                    payment_intent: paymentIntentId,
                });

                const { orderId } = session.data[0].metadata;
                await Order.findByIdAndDelete(orderId);
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
        
        const orders = await Order.find({
            userId,
            $or: [ {paymentType: "COD"}, {isPaid: true} ]
        }).populate("items.product address").sort({createdAt: -1});

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
