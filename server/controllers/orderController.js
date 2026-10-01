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

//Place Order Stripe: /api/order/stripe
export const placeOrderStripe = async (req, res) => {
    try {
        const userId = req.userId;
        const { items, address } = req.body;
        const { origin } = req.headers;

        const { orderFields, productData, tax } = await buildOrder(userId, items, address);

        // Saved only after Stripe accepts the session, so failed checkouts leave no stray orders
        const order = new Order({ ...orderFields, paymentType: "Online", isPaid: false });

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

        await order.save();

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
