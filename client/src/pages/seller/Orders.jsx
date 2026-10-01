import React, { useEffect, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { assets } from '../../assets/assets';
import toast from 'react-hot-toast';

const Orders = () => {
  const { currency, axios } = useAppContext();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    axios.get('/api/order/seller')
      .then(({ data }) => {
        if(data.success){
          setOrders(data.orders)
        }else{
          toast.error(data.message)
        }
      })
      .catch((error) => toast.error(error.message));
  }, [axios]);

  return (
    <div className='no-scrollbar flex-1 h-[95vh] overflow-y-scroll'>
      <div className="md:p-10 p-4 space-y-4">
        <h2 className="text-lg font-medium">Orders List</h2>
        {orders.map((order) => {
          // Use the address copy saved with the order; older orders only have the linked address
          const address = order.shippingAddress || order.address
          return (
          <div key={order._id} className="flex flex-col md:items-center md:flex-row gap-5 justify-between p-5 max-w-4xl rounded-md border border-gray-300">
            <div className="flex gap-5 max-w-80">
              <img className="w-12 h-12 object-cover" src={assets.box_icon} alt="boxIcon" />
              <div>
                {order.items.filter((item) => item.product).map((item, index) => (
                  <div key={index} className="flex flex-col">
                    <p className="font-medium">
                      {item.product.name} {" "}
                      <span className="text-primary">x {item.quantity}</span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {address && <div className="text-sm md:text-base text-black/70">
              <p className='text-black/80'>{address.firstName} {address.lastName}</p>

              <p>{address.street}, {address.city}</p>
              <p> {address.state}, {address.zipcode}, {address.country}</p>
              <p>{address.phone}</p>
            </div>}

            <p className="font-medium text-lg my-auto">{currency}{order.amount.toFixed(2)}</p>

            <div className="flex flex-col text-sm">
              <p>Method: {order.paymentType}</p>
              <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
              <p>Payment: {order.isPaid ? "Paid" : "Pending"}</p>
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}

export default Orders