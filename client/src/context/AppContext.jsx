import { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';

axios.defaults.withCredentials = true;
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

// Endpoints that need the seller token instead of the user token
const SELLER_ENDPOINTS = ['/api/seller', '/api/product/add', '/api/product/stock', '/api/order/seller'];

// Attach the right token to every request, read fresh from localStorage each time,
// so a seller login never overwrites the user's Authorization header (and vice versa)
axios.interceptors.request.use((config) => {
    const url = config.url || '';
    const isSellerRequest = SELLER_ENDPOINTS.some((path) => url.startsWith(path));
    const token = localStorage.getItem(isSellerRequest ? 'sellerToken' : 'token');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

const AppContext = createContext();

export const AppContextProvider = ({ children }) => {

    const currency = import.meta.env.VITE_CURRENCY || "$";

    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [isSeller, setIsSeller] = useState(false)
    const [showUserLogin, setShowUserLogin] = useState(false)
    const [products, setProducts] = useState([])
    const [cartItems, setCartItems] = useState(() => {
        try {
            const savedCart = localStorage.getItem('cartItems');
            return savedCart ? JSON.parse(savedCart) : {};
        } catch {
            return {};
        }
    })
    const [searchQuery, setSearchQuery] = useState("")

    const fetchSeller = async () => {
        try {
            const {data} = await axios.get('/api/seller/is-auth')
            setIsSeller(data.success)
        } catch {
            setIsSeller(false)
        }
    }

    const fetchProducts = async () => {
        try {
            const {data} = await axios.get('/api/product/list')
            if(data.success){
                setProducts(data.products)
            }else{
                toast.error(data.message)
            }
        } catch (error) {
            toast.error(error.message)
        }
    }

    const fetchUser = async ()=>{
        try {
            const {data} = await axios.get('/api/user/is-auth');
            if (data.success){
                setUser(data.user)
                if(data.user.cartItems){
                    setCartItems(data.user.cartItems)
                }
            }
        } catch {
            setUser(null)
        }
    }

    const addToCart = (itemId) => {
        let cartData = structuredClone(cartItems);

        if (cartData[itemId]) {
            cartData[itemId] += 1;
        } else {
            cartData[itemId] = 1;
        }
        setCartItems(cartData);
        toast.success("Added to cart");
    }

    const updateCartItem = (itemId, quantity) => {
        let cartData = structuredClone(cartItems);
        cartData[itemId] = quantity;
        setCartItems(cartData);
        toast.success("Cart updated");
    }

    const removeFromCart = (itemId) => {
        let cartData = structuredClone(cartItems);
        if (cartData[itemId]) {
            cartData[itemId] -= 1;
            if (cartData[itemId] === 0) {
                delete cartData[itemId];
            }
        }
        toast.success("Removed from cart");
        setCartItems(cartData);
    }

    const getCartCount = () => {
        let totalCount = 0;
        for (const itemId in cartItems) {
            totalCount += cartItems[itemId];
        }
        return totalCount;
    }

    const getCartAmount = () => {
        let totalAmount = 0
        for (const itemId in cartItems) {
            const itemInfo = products.find((product) => product._id === itemId);
            if (itemInfo && cartItems[itemId] > 0) {
                totalAmount += itemInfo.offerPrice * cartItems[itemId];
            }
        }
        return Math.floor(totalAmount * 100) / 100;
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load from the API
        fetchUser()
        fetchSeller()
        fetchProducts()
    },[])

    useEffect(() => {
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    }, [cartItems])

    useEffect(()=>{
        const updateCart = async ()=>{
            try {
                const { data } = await axios.post('/api/cart/update', {cartItems})
                if (!data.success){
                    toast.error(data.message)
                }
            } catch (error) {
                toast.error(error.message)
            }
        }

        if(user){
            updateCart()
        }
    },[cartItems, user])

    const value = { navigate, user, setUser, isSeller, setIsSeller, showUserLogin, setShowUserLogin, products, currency, addToCart,updateCartItem, removeFromCart, cartItems, searchQuery,setSearchQuery, getCartAmount, getCartCount, axios, fetchProducts, setCartItems };

    return <AppContext.Provider value={value}>
        {children}
    </AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAppContext = () => {
    return useContext(AppContext)
}
