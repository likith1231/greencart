import jwt from "jsonwebtoken";

const authUser = async (req, res, next) => {
    // Get token from Authorization header or cookies
    const authHeader = req.headers.authorization;
    let token;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7); // Remove "Bearer " prefix
    } else {
        token = req.cookies.token;
    }

    if (!token) {
        return res.json({ success: false, message: "Not Authorized" });
    }

    try {
        const tokenDecode = jwt.verify(token, process.env.JWT_SECRET);

        if (tokenDecode.id) {
            // Store userId in request object for use in controllers
            req.userId = tokenDecode.id;
            next();
        } else {
            return res.json({ success: false, message: "Not Authorized" });
        }
    } catch (error) {
        return res.json({ success: false, message: error.message });
    }
};

export default authUser;