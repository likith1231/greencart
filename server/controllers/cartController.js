import User from "../models/User.js";

//update User CarData : /api/cart/update
export const updateCart = async (req, res) => {
    try {
        const { cartItems } = req.body;
        await User.findByIdAndUpdate(req.userId, { cartItems });
        res.json({ success: true, message: "Cart Updated" });
    } catch (err) {
        console.log(err.message);
        res.json({ success: false, message: err.message });
    }
};