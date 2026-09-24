import Product from "../models/product.js";
import { v2 as cloudinary } from "cloudinary";


//Add Product : /api/product/add
export const addProduct = async (req, res) => {
    try {
        let productData = JSON.parse(req.body.productData);

        const images = req.files || [];

        if (images.length === 0) {
            return res.json({ success: false, message: "Please upload at least one image" });
        }

        let imagesUrl = await Promise.all(
            images.map(async (item) => {
                let result = await cloudinary.uploader.upload(item.path,
                    { resource_type: 'image' });

                return result.secure_url;
            })
        )

        await Product.create({ ...productData, image: imagesUrl });

        res.json({ success: true, message: "Product Added" });
    } catch (error) {
        console.log("error occurring adding product : ", error.message);
        res.json({ success: false, message: error.message });
    }
};

//Get Product : /api/product/list
export const productList = async (req, res) => {
    try {
        const products = await Product.find({});
        res.json({ success: true, products });
    } catch (error) {
        console.log("error occurring fetching product : ", error.message);
        res.json({ success: false, message: error.message });
    }
};

//Get Single Product : /api/product/id
export const productById = async (req, res) => {
    try {
        const id = req.query.id || req.body?.id;
        const product = await Product.findById(id);

        if (!product) {
            return res.json({ success: false, message: "Product not found" });
        }

        res.json({ success: true, product });
    } catch (error) {
        console.log("error occurring fetching product : ", error.message);
        res.json({ success: false, message: error.message });
    }
};

//Change Product isStock : /api/product/stock
export const changeStock = async (req, res) => {
    try {
        const { id, isStock } = req.body;
        await Product.findByIdAndUpdate(id, { isStock });
        res.json({ success: true, message: 'Stock Updated'});
    } catch (error) {
        console.log("error occurring  product inStock : ", error.message);
        res.json({ success: false, message: error.message });
    }
};