import { createContext, useState, useContext, useEffect } from 'react';
import { data, useNavigate } from 'react-router-dom';
import { dummyProducts } from '../assets/assets';
import  toast  from 'react-hot-toast';
import axios from 'axios';

axios.defaults.withCredentials = true;
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

// Add token to axios headers if it exists in localStorage
const setupAxios = () => {
    const token = localStorage.getItem('token');
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete axios.defaults.headers.common['Authorization'];
    }
};

setupAxios();

export const AppContext = createContext();

export const AppContextProvider = ({ children }) => {

    const currency = "$";
    
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
    const [searchQuery, setSearchQuery] = useState({})

    const fetchSeller = async () => {
        try {
            const {data} = await axios.get('/api/seller/is-auth')
            if(data.success){
                setIsSeller(true)
            }else{
                setIsSeller(false)
            }
        } catch (error) {
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
        } catch (error) {
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
            if (cartItems[itemId] > 0 ) {
                totalAmount += itemInfo.offerPrice * cartItems[itemId];
            }
        }
        return Math.floor(totalAmount * 100) / 100;
    };

    useEffect(() => {
        // Restore token from localStorage on app load
        const token = localStorage.getItem('token');
        const sellerToken = localStorage.getItem('sellerToken');
        
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        }
        if (sellerToken) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${sellerToken}`;
        }
        
        fetchUser()
        fetchSeller()
        fetchProducts()
    },[])

    useEffect(() => {
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    }, [cartItems])

    useEffect(() => {
        fetchProducts()
    }, [user])

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
    },[cartItems]) 

    const value = { navigate, user, setUser, isSeller, setIsSeller, showUserLogin, setShowUserLogin, products, currency, addToCart,updateCartItem, removeFromCart, cartItems, searchQuery,setSearchQuery, getCartAmount, getCartCount, axios, fetchProducts, setCartItems }; 

    return <AppContext.Provider value={value}>
        {children}
    </AppContext.Provider>
}

export const useAppContext = () => {
    return useContext(AppContext)
}