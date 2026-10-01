import express from "express";
import authUser from "../middlewares/authUser.js";
import { getAllOrders, getUserOrders, payExistingOrder, placeOrderCOD, placeOrderStripe } from "../controllers/orderController.js";
import authSeller from "../middlewares/authSeller.js";

const orderRouter = express.Router();

orderRouter.post("/cod", authUser, placeOrderCOD);
orderRouter.get("/user", authUser, getUserOrders);
orderRouter.get("/seller", authSeller, getAllOrders);
orderRouter.post("/stripe", authUser, placeOrderStripe);
orderRouter.post("/pay", authUser, payExistingOrder);

export default orderRouter;