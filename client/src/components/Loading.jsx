import React from 'react'
import { useAppContext } from '../context/AppContext'
import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import toast from 'react-hot-toast'

const Loading = () => {

    const { navigate, axios, setCartItems, authChecked } = useAppContext()
    let {search } = useLocation()
    const query = new URLSearchParams(search)
    const nextUrl = query.get('next')
    const sessionId = query.get('session_id')

    useEffect(()=>{
        if(!nextUrl){
            return
        }

        // Back from Stripe: confirm the payment ourselves instead of waiting for the webhook.
        // Wait for the login check first: it loads the saved cart, and finishing after
        // the payment check would put the old cart back.
        if(sessionId){
            if(!authChecked){
                return
            }
            let cancelled = false
            let target = `/${nextUrl}`
            axios.post('/api/order/verify', { sessionId })
                .then(({ data }) => {
                    if(cancelled) return
                    if(data.success && data.paid){
                        // Open the order's tracking page after a successful payment
                        if(data.orderId) target = `/my-orders/${data.orderId}`
                        if(!data.payLater){
                            setCartItems({})
                            localStorage.removeItem('cartItems')
                        }
                        toast.success("Payment successful! Your order is placed.")
                    }else{
                        toast.error(data.message || "Payment could not be confirmed")
                    }
                })
                .catch((error) => toast.error(error.message))
                .finally(() => {
                    if(!cancelled) navigate(target)
                })
            return () => { cancelled = true }
        }

        const timer = setTimeout(()=>{
            navigate(`/${nextUrl}`)
        },5000)
        return () => clearTimeout(timer)
    },[nextUrl, sessionId, authChecked, navigate, axios, setCartItems])


  return (
    <div className='flex justify-center items-center h-screen'>
        <div className='animate-spin rounded-full h-24 w-24 border-4 border-gray-300 border-t-primary'></div>
    </div>
  )
}

export default Loading
