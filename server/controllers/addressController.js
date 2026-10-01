import Address from "../models/Address.js"; 

//Add Address: /api/address/add
export const addAddress = async (req, res) => {
    try {
        const { address } = req.body;
        await Address.create({ ...address, userId: req.userId });
        res.json({ success: true, message: "Address added successfully" });
    } catch (error) {
        console.log("error adding address : ", error.message);
        res.json({ success: false, message: error.message });
    }
};

//Get Address: /api/address/get
export const getAddress = async (req, res) => {
    try {
        const addresses = await Address.find({ userId: req.userId });
        res.json({ success: true, addresses });
    } catch (error) {
        console.log("error occurring getting the address : ", error.message);
        res.json({ success: false, message: error.message });
    }
};

//Update Address: /api/address/update
export const updateAddress = async (req, res) => {
    try {
        const { id, address } = req.body;
        // Never let the request change who owns the address
        const { _id, userId, ...fields } = address || {};

        const updated = await Address.findOneAndUpdate(
            { _id: id, userId: req.userId },
            fields,
            { new: true, runValidators: true }
        );

        if (!updated) {
            return res.json({ success: false, message: "Address not found" });
        }
        res.json({ success: true, message: "Address updated successfully" });
    } catch (error) {
        console.log("error updating address : ", error.message);
        res.json({ success: false, message: error.message });
    }
};

//Delete Address: /api/address/delete
export const deleteAddress = async (req, res) => {
    try {
        const { id } = req.body;
        const deleted = await Address.findOneAndDelete({ _id: id, userId: req.userId });

        if (!deleted) {
            return res.json({ success: false, message: "Address not found" });
        }
        res.json({ success: true, message: "Address deleted" });
    } catch (error) {
        console.log("error deleting address : ", error.message);
        res.json({ success: false, message: error.message });
    }
};
