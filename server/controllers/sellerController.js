import jwt from "jsonwebtoken";

//Login Seller: /api/seller/login

export const sellerLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const sellerEmail = process.env.SELLER_EMAIL;
        const sellerPassword = process.env.SELLER_PASSWORD;

        if (!sellerEmail || !sellerPassword) {
            return res.json({ success: false, message: "Seller login is not set up: add SELLER_EMAIL and SELLER_PASSWORD on the server" });
        }

        // Emails are compared ignoring capital letters and stray spaces
        const emailMatches = String(email || "").trim().toLowerCase() === sellerEmail.trim().toLowerCase();

        if (emailMatches && password === sellerPassword) {
            const token = jwt.sign({ email: sellerEmail }, process.env.JWT_SECRET, { expiresIn: '7d' });

            res.cookie('sellerToken', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });

            return res.json({ success: true, token, message: "Logged In" });
        } else {
            return res.json({ success: false, message: "Invalid Credentials" });
        }
    } catch (error) {
        console.log('seller login error : ', error.message);
        res.json({ success: false, message: error.message });
    }
};

//Seller isAuth : /api/seller/is-auth
export const isSellerAuth = async (req, res) => {
  try {
    return res.json({ success: true });
  } catch (error) {
    console.log("error when authenticate seller : ", error.message);
    res.json({ success: false, message: error.message });
  }
};

//Logout Seller: /api/seller/logout
export const sellerLogout = async (req, res) => {
  try {
    res.clearCookie('sellerToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
    });

    return res.json({ success: true, message: 'Logged Out' });
  } catch (error) {
    console.log("error when logout seller : ", error.message);
    res.json({ success: false, message: error.message });
  }
};