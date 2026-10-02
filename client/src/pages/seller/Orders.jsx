import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useAppContext } from '../../context/AppContext'
import { assets } from '../../assets/assets';
import toast from 'react-hot-toast';
import { CANCELLED, ORDER_STEPS, STATUS_BADGE_CLASSES, formatDateTime, stepTimes } from '../../utils/orderStatus';

const FILTERS = ["Active", "Delivered", "Cancelled", "All"];

// Label for the button that moves an order to its next step
const NEXT_STEP_LABELS = {
  "Confirmed": "Confirm order",
  "Packed": "Mark as packed",
  "Out for Delivery": "Send out for delivery",
  "Delivered": "Mark as delivered",
};

const nextStepOf = (order) => ORDER_STEPS[ORDER_STEPS.indexOf(order.status) + 1];

const Orders = () => {
  const { currency, axios } = useAppContext();
  const [orders, setOrders] = useState([]);
  const [autoProgress, setAutoProgress] = useState(false);
  const [filter, setFilter] = useState("Active");
  const [busyOrderId, setBusyOrderId] = useState(null);
  // Order waiting for delivery partner details before going out for delivery
  const [dispatchOrderId, setDispatchOrderId] = useState(null);
  const [partner, setPartner] = useState({ name: "", phone: "" });
  const knownOrderIds = useRef(null);

  const loadOrders = useCallback(() => {
    return axios.get('/api/order/seller')
      .then(({ data }) => {
        if(!data.success){
          toast.error(data.message, { id: 'seller-orders-error' })
          return
        }
        // Notify about orders that arrived since the last check
        if (knownOrderIds.current) {
          const newOrders = data.orders.filter((order) => !knownOrderIds.current.has(order._id))
          if (newOrders.length > 0) {
            toast.success(newOrders.length === 1 ? "New order received! 🛒" : `${newOrders.length} new orders received! 🛒`, { duration: 5000 })
          }
        }
        knownOrderIds.current = new Set(data.orders.map((order) => order._id))
        setOrders(data.orders)
        setAutoProgress(Boolean(data.autoProgress))
      })
      .catch((error) => toast.error(error.message, { id: 'seller-orders-error' }));
  }, [axios]);

  // Check for new orders every 20 seconds
  useEffect(() => {
    loadOrders();
    const timer = setInterval(loadOrders, 20000);
    return () => clearInterval(timer);
  }, [loadOrders]);

  const updateStatus = async (order, status, extra = {}) => {
    setBusyOrderId(order._id);
    try {
      const { data } = await axios.post('/api/order/status', { orderId: order._id, status, ...extra });
      if (data.success) {
        toast.success(data.message);
        setDispatchOrderId(null);
        await loadOrders();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
    setBusyOrderId(null);
  };

  const advance = (order) => {
    const next = nextStepOf(order);
    if (next === "Out for Delivery") {
      setDispatchOrderId(order._id);
      setPartner({ name: "", phone: "" });
      return;
    }
    updateStatus(order, next);
  };

  const cancel = (order) => {
    const reason = window.prompt("Reason for cancelling this order (the customer will see it):", "Item out of stock");
    if (reason === null) return;
    updateStatus(order, CANCELLED, { reason: reason.trim() || "Cancelled by the store" });
  };

  const counts = {
    Active: orders.filter((o) => o.status !== "Delivered" && o.status !== CANCELLED).length,
    Delivered: orders.filter((o) => o.status === "Delivered").length,
    Cancelled: orders.filter((o) => o.status === CANCELLED).length,
    All: orders.length,
  };

  const visibleOrders = orders.filter((order) => {
    if (filter === "Active") return order.status !== "Delivered" && order.status !== CANCELLED;
    if (filter === "All") return true;
    return order.status === filter;
  });

  return (
    <div className='no-scrollbar flex-1 h-[95vh] overflow-y-scroll'>
      <div className="md:p-10 p-4 space-y-4">
        <h2 className="text-lg font-medium">Orders</h2>

        {autoProgress && (
          <p className='text-sm text-gray-600 bg-primary/10 border border-primary/30 rounded-md px-4 py-2 max-w-4xl'>
            ⚡ Demo mode: orders move forward on their own (confirmed after 1 min, packed after 4, out for delivery after 8, delivered after 27).
            You can still move them faster or cancel them here. Set <code>AUTO_PROGRESS_ORDERS=false</code> on the server to turn this off.
          </p>
        )}

        <div className='flex gap-2 flex-wrap'>
          {FILTERS.map((name) => (
            <button key={name} onClick={() => setFilter(name)}
              className={`px-4 py-1.5 rounded-full text-sm border cursor-pointer transition ${filter === name ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {name} ({counts[name]})
            </button>
          ))}
        </div>

        {visibleOrders.length === 0 && <p className='text-gray-500 text-sm'>No {filter.toLowerCase()} orders.</p>}

        {visibleOrders.map((order) => {
          // Use the address copy saved with the order; older orders only have the linked address
          const address = order.shippingAddress || order.address
          const next = nextStepOf(order)
          const finished = order.status === "Delivered" || order.status === CANCELLED
          const lastUpdate = stepTimes(order)[order.status]
          const busy = busyOrderId === order._id

          return (
          <div key={order._id} className="p-5 max-w-4xl rounded-md border border-gray-300 space-y-4">
            <div className='flex flex-wrap items-center justify-between gap-2'>
              <p className='text-sm text-gray-500'>Order #{order._id.slice(-6).toUpperCase()} · {formatDateTime(order.createdAt)}</p>
              <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_BADGE_CLASSES[order.status] || 'bg-gray-100 text-gray-600'}`}>
                {order.status}{lastUpdate && order.status !== "Order Placed" ? ` · ${formatDateTime(lastUpdate)}` : ''}
              </span>
            </div>

            <div className="flex flex-col md:flex-row gap-5 justify-between">
              <div className="flex gap-4 max-w-80">
                <img className="w-12 h-12 object-cover" src={assets.box_icon} alt="boxIcon" />
                <div>
                  {order.items.filter((item) => item.product).map((item, index) => (
                    <p key={index} className="font-medium">
                      {item.product.name} <span className="text-primary">x {item.quantity}</span>
                    </p>
                  ))}
                </div>
              </div>

              {address && <div className="text-sm text-black/70">
                <p className='text-black/80'>{address.firstName} {address.lastName}</p>
                <p>{address.street}, {address.city}</p>
                <p>{address.state}, {address.zipcode}, {address.country}</p>
                <p>{address.phone}</p>
              </div>}

              <div className="text-sm">
                <p className="font-medium text-lg">{currency}{order.amount.toFixed(2)}</p>
                <p>Method: {order.paymentType}</p>
                <p>Payment: {order.refundStatus === "refunded" ? "Refunded" : order.refundStatus === "pending" ? "Refund pending" : order.isPaid ? "Paid" : "Pending"}</p>
              </div>
            </div>

            {order.deliveryPartner?.name && (
              <p className='text-sm text-gray-600'>🛵 Delivery partner: {order.deliveryPartner.name}{order.deliveryPartner.phone ? ` (${order.deliveryPartner.phone})` : ''}</p>
            )}
            {order.status === CANCELLED && (
              <p className='text-sm text-red-600'>
                Cancelled by {order.cancelledBy === "seller" ? "you" : order.cancelledBy || "customer"}{order.cancelReason ? `: ${order.cancelReason}` : ''}
              </p>
            )}

            {!finished && (
              <div className='border-t border-gray-200 pt-4'>
                {dispatchOrderId === order._id ? (
                  <form onSubmit={(e) => { e.preventDefault(); updateStatus(order, "Out for Delivery", { deliveryPartner: partner }); }}
                    className='flex flex-wrap items-center gap-2'>
                    <input value={partner.name} onChange={(e) => setPartner({ ...partner, name: e.target.value })} required
                      placeholder="Delivery partner name" className='border border-gray-300 rounded px-3 py-2 text-sm outline-primary' />
                    <input value={partner.phone} onChange={(e) => setPartner({ ...partner, phone: e.target.value })} required
                      placeholder="Phone number" type="tel" className='border border-gray-300 rounded px-3 py-2 text-sm outline-primary' />
                    <button disabled={busy} className='px-4 py-2 text-sm bg-primary text-white rounded cursor-pointer disabled:opacity-60'>Send out</button>
                    <button type="button" onClick={() => setDispatchOrderId(null)} className='px-4 py-2 text-sm text-gray-600 cursor-pointer'>Back</button>
                  </form>
                ) : (
                  <div className='flex flex-wrap gap-2'>
                    <button onClick={() => advance(order)} disabled={busy}
                      className='px-4 py-2 text-sm bg-primary hover:bg-primary-dull text-white rounded cursor-pointer transition disabled:opacity-60'>
                      {busy ? 'Updating...' : NEXT_STEP_LABELS[next]}
                    </button>
                    <button onClick={() => cancel(order)} disabled={busy}
                      className='px-4 py-2 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 cursor-pointer transition disabled:opacity-60'>
                      Cancel order
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )
}

export default Orders
