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

//Add many products at once (used to load the demo catalogue) : /api/product/bulk-add
export const bulkAddProducts = async (req, res) => {
    try {
        const { products } = req.body;

        if (!Array.isArray(products) || products.length === 0 || products.length > 200) {
            return res.json({ success: false, message: "Send between 1 and 200 products" });
        }

        // Skip products that already exist, so loading twice doesn't create duplicates
        const existing = new Set((await Product.find({}, { name: 1 })).map((product) => product.name));

        const newProducts = products
            .filter((product) => product && !existing.has(product.name))
            .map(({ name, description, price, offerPrice, image, category }) => ({
                name, description, price, offerPrice, image, category, isStock: true,
            }));

        if (newProducts.length === 0) {
            return res.json({ success: true, message: "All these products are already in your store" });
        }

        // Validates every product against the schema before saving any
        await Product.insertMany(newProducts);

        res.json({ success: true, message: `Added ${newProducts.length} products` });
    } catch (error) {
        console.log("error adding products : ", error.message);
        res.json({ success: false, message: error.message });
    }
};
