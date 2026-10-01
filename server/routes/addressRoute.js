import express from "express";
import authUser from "../middlewares/authUser.js";
import { addAddress, deleteAddress, getAddress, updateAddress } from "../controllers/addressController.js";

const addressRouter = express.Router();

addressRouter.post("/add", authUser, addAddress);
addressRouter.get("/get", authUser, getAddress);
addressRouter.post("/update", authUser, updateAddress);
addressRouter.post("/delete", authUser, deleteAddress);

export default addressRouter;