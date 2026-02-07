import jwt from 'jsonwebtoken'

const authSeller = async (req, res, next)=>{
    // Get token from Authorization header or cookies
    const authHeader = req.headers.authorization;
    let sellerToken;

    if (authHeader && authHeader.startsWith("Bearer ")) {
        sellerToken = authHeader.substring(7); // Remove "Bearer " prefix
    } else {
        sellerToken = req.cookies.sellerToken;
    }

    if(!sellerToken) {
        return res.json({ success:  false, message: 'Not Authorized'});
    }

     try {
            const tokenDecode = jwt.verify(sellerToken, process.env.JWT_SECRET);
    
            if (tokenDecode.email === process.env.SELLER_EMAIL) {
               next();
            } else {
                return res.json({ success: false, message: "Not Authorized" });
            }

        } catch (error) {
            res.json({ success: false, message: error.message });
        }
}

export default authSeller