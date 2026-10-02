import express from "express";
import authUser from "../middlewares/authUser.js";
import { cancelOrderByUser, getAllOrders, getOrderDetails, getOrderUpdates, getUserOrders, payExistingOrder, placeOrderCOD, placeOrderStripe, updateOrderStatus, verifyStripePayment } from "../controllers/orderController.js";
import authSeller from "../middlewares/authSeller.js";

const orderRouter = express.Router();

orderRouter.post("/cod", authUser, placeOrderCOD);
orderRouter.get("/user", authUser, getUserOrders);
orderRouter.get("/details", authUser, getOrderDetails);
orderRouter.get("/updates", authUser, getOrderUpdates);
orderRouter.post("/cancel", authUser, cancelOrderByUser);
orderRouter.get("/seller", authSeller, getAllOrders);
orderRouter.post("/status", authSeller, updateOrderStatus);
orderRouter.post("/stripe", authUser, placeOrderStripe);
orderRouter.post("/pay", authUser, payExistingOrder);
orderRouter.post("/verify", authUser, verifyStripePayment);

export default orderRouter;
