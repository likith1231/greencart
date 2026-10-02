import React, { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAppContext } from '../context/AppContext'
import {
  CANCELLED, ORDER_STEPS, STATUS_BADGE_CLASSES, STEP_DESCRIPTIONS, deliveryHeadline, displayStatus,
  formatDateTime, formatTime, isAwaitingPayment, stepTimes,
} from '../utils/orderStatus'

const CANCEL_REASONS = [
  "Ordered by mistake",
  "Want to change items",
  "Delivery is taking too long",
  "Want to change the delivery address",
  "Found a better price elsewhere",
  "Other",
]

// Customers can cancel until the order leaves the store (matches the server)
const CANCELLABLE = ["Order Placed", "Confirmed", "Packed"]

const OrderTracking = () => {
  const { id } = useParams()
  const { axios, user, authChecked, currency, navigate, ordersVersion, reorder } = useAppContext()
  const [order, setOrder] = useState(null)
  const [notFound, setNotFound] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  // Difference between the server's clock and this device's, so a wrong device clock
  // doesn't break the "Arriving in X min" countdown
  const [clockOffset, setClockOffset] = useState(0)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0])
  const [busy, setBusy] = useState(false)

  const loadOrder = useCallback(() => {
    return axios.get('/api/order/details', { params: { id } })
      .then(({ data }) => {
        if (data.success) {
          setOrder(data.order)
          if (data.serverTime) setClockOffset(data.serverTime - Date.now())
        } else {
          setNotFound(true)
        }
      })
      .catch((error) => toast.error(error.message, { id: 'order-load-error' }))
  }, [axios, id])

  // Load now, refresh every 15 seconds, and whenever the background check spots a change
  useEffect(() => {
    if (!user) return
    loadOrder()
    const timer = setInterval(loadOrder, 15000)
    return () => clearInterval(timer)
  }, [user, loadOrder, ordersVersion])

  useEffect(() => {
    if (authChecked && !user) navigate('/')
  }, [authChecked, user, navigate])

  // Keep the "Arriving in X min" countdown current
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const cancelOrder = async () => {
    setBusy(true)
    try {
      const { data } = await axios.post('/api/order/cancel', { orderId: id, reason: cancelReason })
      if (data.success) {
        toast.success(data.message, { duration: 5000 })
        setShowCancel(false)
        await loadOrder()
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      toast.error(error.message)
    }
    setBusy(false)
  }

  const payOnline = async () => {
    setBusy(true)
    try {
      const { data } = await axios.post('/api/order/pay', { orderId: id })
      if (data.success) {
        window.location.replace(data.url)
        return
      }
      toast.error(data.message)
      await loadOrder()
    } catch (error) {
      toast.error(error.message)
    }
    setBusy(false)
  }

  const handleReorder = () => {
    const added = reorder(order)
    if (added === 0) {
      toast.error("These items are not available right now")
      return
    }
    toast.success("Items added to your cart")
    navigate('/cart')
  }

  if (notFound) {
    return (
      <div className='mt-16 pb-16 text-center'>
        <p className='text-xl text-gray-700'>Order not found</p>
        <button onClick={() => navigate('/my-orders')} className='mt-4 text-primary hover:underline cursor-pointer'>Back to My Orders</button>
      </div>
    )
  }

  if (!order) {
    return (
      <div className='flex justify-center items-center h-[60vh]'>
        <div className='animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-primary'></div>
      </div>
    )
  }

  const items = order.items.filter((item) => item.product)
  const itemPrice = (item) => item.price ?? item.product.offerPrice
  const subtotal = order.subtotal ?? items.reduce((sum, item) => sum + itemPrice(item) * item.quantity, 0)
  const tax = order.tax ?? Math.max(order.amount - subtotal, 0)
  const address = order.shippingAddress || order.address
  const status = displayStatus(order)
  const cancelled = order.status === CANCELLED
  const awaitingPayment = isAwaitingPayment(order)
  const times = stepTimes(order)
  const currentStep = ORDER_STEPS.indexOf(order.status)
  const progress = cancelled ? 0 : Math.max(currentStep, 0) / (ORDER_STEPS.length - 1) * 100
  const canCancel = CANCELLABLE.includes(order.status)

  let paymentStatus = order.isPaid ? "Paid" : order.paymentType === "COD" ? "Pay on delivery" : "Payment pending"
  if (order.refundStatus === "refunded") paymentStatus = "Refunded to your card"
  if (order.refundStatus === "pending") paymentStatus = "Refund being processed"

  return (
    <div className='mt-10 pb-16 max-w-3xl'>
      <button onClick={() => navigate('/my-orders')} className='text-sm text-gray-500 hover:text-primary cursor-pointer print:hidden'>
        ← My Orders
      </button>

      {/* Delivery headline */}
      <div className={`mt-4 rounded-2xl p-5 md:p-6 ${cancelled ? 'bg-red-50' : 'bg-primary/10'}`}>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <p className={`text-2xl md:text-3xl font-semibold ${cancelled ? 'text-red-600' : 'text-gray-800'}`}>{deliveryHeadline(order, now + clockOffset)}</p>
            {!cancelled && !awaitingPayment && order.status !== "Delivered" && order.estimatedDeliveryAt && (
              <p className='text-gray-600 mt-1'>Expected by {formatTime(order.estimatedDeliveryAt)}</p>
            )}
            {awaitingPayment && <p className='text-gray-600 mt-1'>Complete the payment to confirm this order</p>}
            {cancelled && (
              <p className='text-gray-600 mt-1'>
                {order.cancelledBy === "seller" ? "Cancelled by the store" : order.cancelledBy === "system" ? "Closed automatically" : "You cancelled this order"}
                {order.cancelReason ? ` · ${order.cancelReason}` : ''}
              </p>
            )}
          </div>
          <span className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_BADGE_CLASSES[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
        </div>

        {!cancelled && !awaitingPayment && (
          <div className='mt-5 h-2 bg-white rounded-full overflow-hidden'>
            <div className='h-full bg-primary rounded-full transition-all duration-700' style={{ width: `${progress}%` }}></div>
          </div>
        )}
      </div>

      {/* Delivery partner */}
      {order.deliveryPartner?.name && !cancelled && (
        <div className='mt-4 border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <div className='w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center text-lg font-semibold'>
              {order.deliveryPartner.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className='font-medium text-gray-800'>{order.deliveryPartner.name}</p>
              <p className='text-sm text-gray-500'>{order.status === "Delivered" ? "Delivered your order" : "Your delivery partner"}</p>
            </div>
          </div>
          {order.status === "Out for Delivery" && order.deliveryPartner.phone && (
            <a href={`tel:${order.deliveryPartner.phone}`} className='px-4 py-2 text-sm border border-primary text-primary rounded-lg hover:bg-primary/10 transition'>
              📞 Call
            </a>
          )}
        </div>
      )}

      {/* Timeline */}
      {!awaitingPayment && (
        <div className='mt-4 border border-gray-200 rounded-xl p-5'>
          <p className='font-medium text-gray-800 mb-4'>Order status</p>
          <ol>
            {ORDER_STEPS.map((step, index) => {
              const done = !cancelled ? index <= currentStep : Boolean(times[step])
              const isLast = index === ORDER_STEPS.length - 1
              if (cancelled && !times[step]) return null
              return (
                <li key={step} className='flex gap-3'>
                  <div className='flex flex-col items-center'>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${done ? 'bg-primary text-white' : 'border-2 border-gray-300 bg-white'}`}>
                      {done ? '✓' : ''}
                    </span>
                    {(!isLast || cancelled) && <span className={`w-0.5 flex-1 min-h-6 ${done && index < currentStep ? 'bg-primary' : 'bg-gray-200'}`}></span>}
                  </div>
                  <div className='pb-5'>
                    <p className={`font-medium ${done ? 'text-gray-800' : 'text-gray-400'}`}>{step}</p>
                    <p className='text-sm text-gray-500'>{STEP_DESCRIPTIONS[step]}</p>
                    {times[step] && <p className='text-xs text-gray-400 mt-0.5'>{formatDateTime(times[step])}</p>}
                  </div>
                </li>
              )
            })}
            {cancelled && (
              <li className='flex gap-3'>
                <span className='w-6 h-6 rounded-full flex items-center justify-center text-xs bg-red-500 text-white'>✕</span>
                <div>
                  <p className='font-medium text-red-600'>Cancelled</p>
                  {order.cancelReason && <p className='text-sm text-gray-500'>{order.cancelReason}</p>}
                  {times[CANCELLED] && <p className='text-xs text-gray-400 mt-0.5'>{formatDateTime(times[CANCELLED])}</p>}
                </div>
              </li>
            )}
          </ol>
        </div>
      )}

      {/* Actions */}
      <div className='flex flex-wrap gap-2 mt-4 print:hidden'>
        {!order.isPaid && !cancelled && (
          <button onClick={payOnline} disabled={busy}
            className='px-5 py-2.5 bg-primary hover:bg-primary-dull text-white rounded-lg cursor-pointer transition disabled:opacity-60'>
            Pay {currency}{order.amount.toFixed(2)} online
          </button>
        )}
        {canCancel && (
          <button onClick={() => setShowCancel(true)}
            className='px-5 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 cursor-pointer transition'>
            Cancel order
          </button>
        )}
        {(order.status === "Delivered" || cancelled) && (
          <button onClick={handleReorder}
            className='px-5 py-2.5 bg-primary hover:bg-primary-dull text-white rounded-lg cursor-pointer transition'>
            Reorder
          </button>
        )}
        <button onClick={() => window.print()}
          className='px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 cursor-pointer transition'>
          Print invoice
        </button>
      </div>

      {/* Items */}
      <div className='mt-4 border border-gray-200 rounded-xl p-5'>
        <p className='font-medium text-gray-800 mb-3'>{items.length} item{items.length === 1 ? '' : 's'} in this order</p>
        <div className='divide-y divide-gray-100'>
          {items.map((item, index) => (
            <div key={index} className='flex items-center gap-3 py-3'>
              <div className='bg-primary/10 rounded-lg p-1.5 shrink-0'>
                <img src={item.product.image[0]} alt={item.product.name} className='w-12 h-12 object-contain' />
              </div>
              <div className='flex-1 min-w-0'>
                <p className='text-gray-800 truncate'>{item.product.name}</p>
                <p className='text-sm text-gray-500'>{item.quantity} × {currency}{itemPrice(item).toFixed(2)}</p>
              </div>
              <p className='font-medium text-gray-800'>{currency}{(itemPrice(item) * item.quantity).toFixed(2)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className='grid md:grid-cols-2 gap-4 mt-4'>
        {/* Bill */}
        <div className='border border-gray-200 rounded-xl p-5 text-sm text-gray-600 space-y-1.5'>
          <p className='font-medium text-gray-800 text-base mb-2'>Bill details</p>
          <p className='flex justify-between'><span>Item total</span><span>{currency}{subtotal.toFixed(2)}</span></p>
          <p className='flex justify-between'><span>Delivery fee</span><span className='text-green-600'>Free</span></p>
          <p className='flex justify-between'><span>Tax (2%)</span><span>{currency}{tax.toFixed(2)}</span></p>
          <p className='flex justify-between font-semibold text-gray-800 text-base border-t border-gray-200 pt-2 mt-2'><span>Total</span><span>{currency}{order.amount.toFixed(2)}</span></p>
          <p className='flex justify-between pt-2'><span>Payment</span><span>{order.paymentType === "COD" ? "Cash on Delivery" : "Online (Card)"}</span></p>
          <p className='flex justify-between'><span>Status</span>
            <span className={order.refundStatus || order.isPaid ? 'text-green-600' : 'text-orange-500'}>{paymentStatus}</span>
          </p>
        </div>

        {/* Order info */}
        <div className='border border-gray-200 rounded-xl p-5 text-sm text-gray-600'>
          <p className='font-medium text-gray-800 text-base mb-2'>Order details</p>
          <p className='text-gray-500'>Order ID</p>
          <p className='text-gray-800 mb-2 break-all'>{order._id}</p>
          <p className='text-gray-500'>Placed on</p>
          <p className='text-gray-800 mb-2'>{formatDateTime(order.createdAt)}</p>
          <p className='text-gray-500'>Deliver to</p>
          {address ? (
            <p className='text-gray-800'>
              {address.firstName} {address.lastName}, {address.street}, {address.city}, {address.state} {address.zipcode}, {address.country} · {address.phone}
            </p>
          ) : <p>Address not available</p>}
        </div>
      </div>

      {/* Cancel dialog */}
      {showCancel && (
        <div onClick={() => setShowCancel(false)} className='fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4'>
          <div onClick={(e) => e.stopPropagation()} className='bg-white rounded-xl p-6 w-full max-w-sm'>
            <p className='text-lg font-semibold text-gray-800'>Cancel this order?</p>
            <p className='text-sm text-gray-500 mt-1'>
              {order.isPaid && order.paymentType === "Online" ? `${currency}${order.amount.toFixed(2)} will be refunded to your card.` : "Tell us why you're cancelling."}
            </p>
            <div className='mt-4 space-y-2'>
              {CANCEL_REASONS.map((reason) => (
                <label key={reason} className='flex items-center gap-2 text-sm text-gray-700 cursor-pointer'>
                  <input type="radio" name="cancel-reason" checked={cancelReason === reason} onChange={() => setCancelReason(reason)} className='accent-primary' />
                  {reason}
                </label>
              ))}
            </div>
            <div className='flex gap-2 mt-6'>
              <button onClick={() => setShowCancel(false)} className='flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-700 cursor-pointer hover:bg-gray-50'>Keep order</button>
              <button onClick={cancelOrder} disabled={busy} className='flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg cursor-pointer disabled:opacity-60'>
                {busy ? 'Cancelling...' : 'Cancel order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderTracking
