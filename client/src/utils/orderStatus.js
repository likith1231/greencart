// Order steps and display helpers, shared by the customer and seller order pages

export const ORDER_STEPS = ["Order Placed", "Confirmed", "Packed", "Out for Delivery", "Delivered"];
export const CANCELLED = "Cancelled";

// Shown under each step on the tracking timeline
export const STEP_DESCRIPTIONS = {
  "Order Placed": "We have received your order",
  "Confirmed": "The store has accepted your order",
  "Packed": "Your items are packed and ready",
  "Out for Delivery": "Your order is on the way",
  "Delivered": "Your order has been delivered",
};

// Short message for the update notifications
export const STATUS_NOTIFICATIONS = {
  "Confirmed": "Your order has been confirmed ✅",
  "Packed": "Your order is packed 📦",
  "Out for Delivery": "Your order is out for delivery 🛵",
  "Delivered": "Your order has been delivered 🎉",
  "Cancelled": "Your order was cancelled",
};

export const STATUS_BADGE_CLASSES = {
  "Order Placed": "bg-blue-50 text-blue-600",
  "Confirmed": "bg-indigo-50 text-indigo-600",
  "Packed": "bg-amber-50 text-amber-600",
  "Out for Delivery": "bg-orange-50 text-orange-600",
  "Delivered": "bg-green-50 text-green-600",
  "Cancelled": "bg-red-50 text-red-600",
  "Awaiting Payment": "bg-gray-100 text-gray-600",
};

// An online order isn't really placed until it's paid
export const isAwaitingPayment = (order) =>
  order.paymentType === "Online" && !order.isPaid && order.status !== CANCELLED;

export const displayStatus = (order) => (isAwaitingPayment(order) ? "Awaiting Payment" : order.status);

export const isActiveOrder = (order) =>
  !isAwaitingPayment(order) && order.status !== CANCELLED && order.status !== "Delivered";

export const formatTime = (date) =>
  new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const formatDateTime = (date) =>
  new Date(date).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// Headline for an order, e.g. "Arriving in 12 min" or "Delivered at 5:42 PM"
export const deliveryHeadline = (order, now = Date.now()) => {
  if (order.status === CANCELLED) return "Order cancelled";
  if (isAwaitingPayment(order)) return "Waiting for payment";
  if (order.status === "Delivered") {
    return `Delivered at ${formatTime(order.deliveredAt || order.updatedAt)}`;
  }
  if (!order.estimatedDeliveryAt) return order.status;
  const minutesLeft = Math.ceil((new Date(order.estimatedDeliveryAt) - now) / 60000);
  return minutesLeft > 0 ? `Arriving in ${minutesLeft} min` : "Arriving any minute now";
};

// Time each step happened; older orders only know when they were placed
export const stepTimes = (order) => {
  const times = {};
  for (const entry of order.statusHistory || []) {
    times[entry.status] = entry.at;
  }
  if (!times["Order Placed"]) times["Order Placed"] = order.createdAt;
  return times;
};
