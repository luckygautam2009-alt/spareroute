/**
 * SpareRoute Adapter: Maps the SpareRoute internal API context
 * to the fields the Inquest engines read. Never invents values.
 *
 * Return status mapping (SpareRoute return_requests.status -> adapter):
 *   requested  -> 'return_requested'
 *   approved   -> 'return_approved'
 *   rejected   -> 'return_rejected'
 *   received   -> 'item_received_warehouse'
 *   refunded   -> 'refunded'
 */

const RETURN_STATUS_MAP = {
  requested: 'return_requested',
  approved: 'return_approved',
  rejected: 'return_rejected',
  received: 'item_received_warehouse',
  refunded: 'refunded',
};

const IN_TRANSIT_STATUSES = ['placed', 'accepted_by_seller', 'out_for_delivery'];

function findTimestampInHistory(statusHistory, toStatus) {
  if (!Array.isArray(statusHistory)) return null;
  const entry = [...statusHistory].reverse().find((h) => h.to === toStatus);
  return entry ? entry.at : null;
}

function adaptOrders(orders) {
  if (!Array.isArray(orders)) return [];
  const now = Date.now();

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber || null,
    customerId: o.customerId,
    product: o.product,
    amount: o.amount,
    status: o.status,
    deliveredAt: o.deliveredAt || null,
    returnRequested: o.returnRequested || false,
    returnStatus: o.returnStatus ? (RETURN_STATUS_MAP[o.returnStatus] || o.returnStatus) : null,
    returnedAt: findTimestampInHistory(o.statusHistory, 'returned'),
    cancelledAt: findTimestampInHistory(o.statusHistory, 'cancelled'),
    cancellationReason: o.cancelReason || null,
    expectedDeliveryBy: o.expectedDeliveryBy || null,
    statusHistory: o.statusHistory || [],
    isInTransit: o.status === 'out_for_delivery',
    isDelayed: o.expectedDeliveryBy
      ? (IN_TRANSIT_STATUSES.includes(o.status) && now > new Date(o.expectedDeliveryBy).getTime())
      : false,
    returnWindowDays: o.returnWindowDays != null ? o.returnWindowDays : null,
    proofOfDelivery: o.deliveredVia === 'otp'
      ? { method: 'otp', verifiedAt: o.deliveryOtpVerifiedAt || null }
      : o.deliveredVia === 'admin_override'
      ? { method: 'admin_override', verifiedAt: null }
      : null,
    deliveredVia: o.deliveredVia || null,
    deliveryOtpVerifiedAt: o.deliveryOtpVerifiedAt || null,
    deliveryOtpFailedAttempts: o.deliveryOtpFailedAttempts != null ? Number(o.deliveryOtpFailedAttempts) : 0,
    deliveryOtpLocked: Boolean(o.deliveryOtpLocked),
  }));
}

function adaptPayments(payments) {
  if (!Array.isArray(payments)) return [];
  return payments.map((p) => ({
    id: p.id,
    orderId: p.orderId,
    customerId: p.customerId,
    amount: p.amount,
    status: p.status, // legacy vocabulary: success/failed/pending
    // COD only — no online gateway exists. Never fabricate these.
    gatewayStatus: null,
    localStatus: null,
    method: p.method,
    collectedAt: p.collectedAt || null,
  }));
}

function adaptRefunds(refunds) {
  if (!Array.isArray(refunds)) return [];
  return refunds.map((r) => ({
    id: r.id,
    orderId: r.orderId,
    customerId: r.customerId,
    amount: r.amount,
    status: r.status,
    reason: r.reason || null,
    initiatedAt: r.initiatedAt || null,
    completedAt: r.completedAt || null,
  }));
}

/**
 * Adapts the full SpareRoute context into the shape the Inquest engines expect.
 * @param {Object} context - The SpareRoute internal API context (data field)
 * @returns {Object} Adapted context with orders[], payments[], refunds[]
 */
function adaptContext(context) {
  if (!context) return null;
  return {
    customer: context.customer,
    orders: adaptOrders(context.orders),
    payments: adaptPayments(context.payments),
    refunds: adaptRefunds(context.refunds),
    returnRequests: context.returnRequests || [],
  };
}

module.exports = {
  adaptContext,
  adaptOrders,
  adaptPayments,
  adaptRefunds,
  RETURN_STATUS_MAP,
};
