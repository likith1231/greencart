import React, { useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const MyOrders = () => {

  const [myOrders, setMyOrders] = useState([]);
  const [payingOrderId, setPayingOrderId] = useState(null);
  const {currency, axios, user} = useAppContext();
  
  useEffect(() => {
    if(!user){
      return;
    }
    axios.get('/api/order/user')
      .then(({data}) => {
        if(data.success){
          setMyOrders(data.orders)
        } else {
          toast.error(data.message)
        }
      })
      .catch((error) => toast.error(error.message));
  }, [user, axios]);

  // Opens Stripe Checkout to pay online for a Cash on Delivery order
  const payOnline = async (orderId) => {
    setPayingOrderId(orderId);
    try {
      const { data } = await axios.post('/api/order/pay', { orderId });
      if (data.success) {
        window.location.replace(data.url);
        return;
      }
      toast.error(data.message);
    } catch (error) {
      toast.error(error.message);
    }
    setPayingOrderId(null);
  };

  return (
    <div className='mt-16 pb-16'>
      <div className='flex flex-col items-end w-max my-8'>
        <p className='text-2xl font-medium uppercase'>My orders</p>
        <div className='w-16 h-0.5 bg-primary rounded-full'></div>
      </div>
      {myOrders.length === 0 && (
        <p className='text-gray-500'>You haven't placed any orders yet.</p>
      )}
      {myOrders.map((order) => {
        const items = order.items.filter((item) => item.product)
        // Older orders didn't store prices or an address copy, so fall back to current data
        const itemPrice = (item) => item.price ?? item.product.offerPrice
        const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + itemPrice(item) * item.quantity, 0)
        const tax = order.tax ?? Math.max(order.amount - subtotal, 0)
        const address = order.shippingAddress || order.address
        const paymentStatus = order.isPaid ? "Paid" : order.paymentType === "COD" ? "Pay on delivery" : "Payment pending"

        return (
        <div key={order._id} className='border border-gray-300 rounded-lg my-10 p-4 py-5 max-w-4xl'>
          <div className='flex justify-between md:items-center text-gray-400 md:font-medium max-md:flex-col gap-1'>
            <span>Order ID : {order._id}</span>
            <span>Placed on : {new Date(order.createdAt).toLocaleDateString()}</span>
            <span>Status : <span className='text-primary'>{order.status}</span></span>
          </div>

          {items.map((item, index) => (
            <div key={index}
            className={`relative bg-white text-gray-500/70 ${
              items.length !== index + 1 ? "border-b" : ""
            } border-gray-300 flex flex-col md:flex-row md:items-center justify-between p-4 py-5 md:gap-16 w-full max-w-4xl`}>
              <div className='flex items-center my-4 md:my-0'>
                <div className='bg-primary/10 p-4 rounded-lg'>
                  <img src={item.product.image[0]} alt="" className='w-16 h-16' />
                </div>
                <div className='ml-4'>
                  <h2 className='text-xl font-medium text-gray-800'>{item.product.name}</h2>
                  <p>Category: {item.product.category}</p>
                </div>
              </div>

              <div className='flex flex-col justify-center md:ml-8 my-4 md:my-0'>
                <p>Price: {currency}{itemPrice(item).toFixed(2)}</p>
                <p>Quantity: {item.quantity}</p>
              </div>

              <p className='text-primary text-lg font-medium'>Amount: {currency}{(itemPrice(item) * item.quantity).toFixed(2)}</p>
            </div>
          ))}

          <div className='flex flex-col md:flex-row justify-between gap-6 border-t border-gray-300 mt-2 pt-4 px-4 text-sm text-gray-500'>
            <div>
              <p className='font-medium text-gray-700 mb-1'>Delivery Address</p>
              {address ? (
                <>
                  <p>{address.firstName} {address.lastName}</p>
                  <p>{address.street}, {address.city}</p>
                  <p>{address.state} {address.zipcode}, {address.country}</p>
                  <p>{address.phone}</p>
                </>
              ) : (
                <p>Address not available</p>
              )}
            </div>

            <div>
              <p className='font-medium text-gray-700 mb-1'>Payment</p>
              <p>Method: {order.paymentType === "COD" ? "Cash on Delivery" : "Online (Card)"}</p>
              <p>Status: <span className={order.isPaid ? 'text-green-600' : 'text-orange-500'}>{paymentStatus}</span></p>
              {!order.isPaid && (
                <button
                  onClick={() => payOnline(order._id)}
                  disabled={payingOrderId !== null}
                  className='mt-3 px-5 py-2 bg-primary hover:bg-primary-dull transition text-white rounded cursor-pointer disabled:opacity-60 disabled:cursor-wait'
                >
                  {payingOrderId === order._id ? "Opening payment..." : `Pay ${currency}${order.amount.toFixed(2)} Online`}
                </button>
              )}
            </div>

            <div className='md:min-w-48'>
              <p className='font-medium text-gray-700 mb-1'>Order Summary</p>
              <p className='flex justify-between gap-6'><span>Subtotal</span><span>{currency}{subtotal.toFixed(2)}</span></p>
              <p className='flex justify-between gap-6'><span>Shipping</span><span className='text-green-600'>Free</span></p>
              <p className='flex justify-between gap-6'><span>Tax (2%)</span><span>{currency}{tax.toFixed(2)}</span></p>
              <p className='flex justify-between gap-6 font-medium text-gray-800 text-base mt-1'><span>Total</span><span>{currency}{order.amount.toFixed(2)}</span></p>
            </div>
          </div>
        </div>
        )
      })}
    </div>
  )
}

export default MyOrders