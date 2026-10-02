import React, { useEffect, useState } from 'react'
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import {
  STATUS_BADGE_CLASSES, deliveryHeadline, displayStatus, formatDateTime, isActiveOrder, isAwaitingPayment,
} from '../utils/orderStatus';

const FILTERS = ["All", "Active", "Delivered", "Cancelled"];

const MyOrders = () => {

  const [myOrders, setMyOrders] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("All");
  const [payingOrderId, setPayingOrderId] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const {currency, axios, user, navigate, ordersVersion, reorder} = useAppContext();

  // Reload when the background check spots a status change
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
      .catch((error) => toast.error(error.message))
      .finally(() => setLoaded(true));
  }, [user, axios, ordersVersion]);

  // Keep the "Arriving in X min" countdown current
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Opens Stripe Checkout to pay online for an unpaid order
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

  const handleReorder = (order) => {
    const added = reorder(order);
    if (added === 0) {
      toast.error("These items are not available right now");
      return;
    }
    toast.success(added === order.items.length ? "Items added to your cart" : "Available items added to your cart");
    navigate('/cart');
  };

  const filteredOrders = myOrders.filter((order) => {
    if (filter === "Active") return isActiveOrder(order) || isAwaitingPayment(order);
    if (filter === "Delivered") return order.status === "Delivered";
    if (filter === "Cancelled") return order.status === "Cancelled";
    return true;
  });

  return (
    <div className='mt-16 pb-16 max-w-4xl'>
      <div className='flex flex-col items-end w-max mb-6'>
        <p className='text-2xl font-medium uppercase'>My orders</p>
        <div className='w-16 h-0.5 bg-primary rounded-full'></div>
      </div>

      <div className='flex gap-2 flex-wrap mb-6'>
        {FILTERS.map((name) => (
          <button key={name} onClick={() => setFilter(name)}
            className={`px-4 py-1.5 rounded-full text-sm border cursor-pointer transition ${filter === name ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {name}
          </button>
        ))}
      </div>

      {loaded && filteredOrders.length === 0 && (
        <p className='text-gray-500'>{myOrders.length === 0 ? "You haven't placed any orders yet." : `No ${filter.toLowerCase()} orders.`}</p>
      )}

      <div className='space-y-4'>
      {filteredOrders.map((order) => {
        const items = order.items.filter((item) => item.product)
        const status = displayStatus(order)
        const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)

        return (
        <div key={order._id} className='border border-gray-200 rounded-xl p-4 md:p-5 bg-white'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <p className='text-lg font-semibold text-gray-800'>{deliveryHeadline(order, now)}</p>
              <p className='text-sm text-gray-500'>
                {itemCount} item{itemCount === 1 ? '' : 's'} · {currency}{order.amount.toFixed(2)} · Placed {formatDateTime(order.createdAt)}
              </p>
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_BADGE_CLASSES[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
          </div>

          <div className='flex gap-2 mt-4 overflow-x-auto'>
            {items.slice(0, 6).map((item, index) => (
              <div key={index} className='relative shrink-0 bg-primary/10 rounded-lg p-1.5'>
                <img src={item.product.image[0]} alt={item.product.name} title={item.product.name} className='w-12 h-12 object-contain' />
                {item.quantity > 1 && (
                  <span className='absolute -top-1.5 -right-1.5 bg-gray-800 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center'>{item.quantity}</span>
                )}
              </div>
            ))}
            {items.length > 6 && <div className='shrink-0 w-[60px] h-[60px] rounded-lg bg-gray-100 flex items-center justify-center text-sm text-gray-500'>+{items.length - 6}</div>}
          </div>

          <div className='flex flex-wrap gap-2 mt-4'>
            <button onClick={() => navigate(`/my-orders/${order._id}`)}
              className='px-4 py-2 text-sm bg-primary hover:bg-primary-dull text-white rounded-lg cursor-pointer transition'>
              {isActiveOrder(order) ? 'Track order' : 'View details'}
            </button>
            {!order.isPaid && order.status !== "Cancelled" && (
              <button onClick={() => payOnline(order._id)} disabled={payingOrderId !== null}
                className='px-4 py-2 text-sm border border-primary text-primary rounded-lg hover:bg-primary/10 cursor-pointer transition disabled:opacity-60 disabled:cursor-wait'>
                {payingOrderId === order._id ? "Opening payment..." : `Pay ${currency}${order.amount.toFixed(2)} now`}
              </button>
            )}
            {(order.status === "Delivered" || order.status === "Cancelled") && (
              <button onClick={() => handleReorder(order)}
                className='px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer transition'>
                Reorder
              </button>
            )}
          </div>
        </div>
        )
      })}
      </div>
    </div>
  )
}

export default MyOrders
