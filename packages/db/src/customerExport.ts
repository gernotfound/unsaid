import type { Order, ReturnCase, WithdrawalNotice } from "@unsaid/domain";
import { getAdminFirestore } from "./firebase";
import { SHIPMENTS_COLLECTION, type CustomerOrderFulfillment, type FulfillmentShipmentRecord } from "./fulfillment";
import { RETURN_CASES_COLLECTION } from "./returns";
import { WITHDRAWAL_NOTICES_COLLECTION } from "./withdrawals";

const ORDERS_COLLECTION = "orders";

export interface CustomerCommerceExport {
  orders: readonly Order[];
  fulfillment: readonly CustomerOrderFulfillment[];
  returns: readonly ReturnCase[];
  withdrawals: readonly WithdrawalNotice[];
}

export async function getCustomerCommerceExport(customerId: string): Promise<CustomerCommerceExport> {
  const db = getAdminFirestore();
  const [ordersSnapshot, shipmentsSnapshot, returnsSnapshot, withdrawalsSnapshot] = await Promise.all([
    db.collection(ORDERS_COLLECTION).where("customerId", "==", customerId).get(),
    db.collection(SHIPMENTS_COLLECTION).where("customerId", "==", customerId).get(),
    db.collection(RETURN_CASES_COLLECTION).where("customerId", "==", customerId).get(),
    db.collection(WITHDRAWAL_NOTICES_COLLECTION).where("customerId", "==", customerId).get(),
  ]);

  const orders = ordersSnapshot.docs
    .map((doc) => doc.data() as Order)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const shipments = new Map(
    shipmentsSnapshot.docs
      .map((doc) => doc.data() as FulfillmentShipmentRecord)
      .map((shipment) => [shipment.orderId, shipment] as const),
  );

  return {
    orders,
    fulfillment: orders.map((order) => ({
      orderId: order.id,
      shipment: shipments.get(order.id) ?? null,
    })),
    returns: returnsSnapshot.docs
      .map((doc) => doc.data() as ReturnCase)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    withdrawals: withdrawalsSnapshot.docs
      .map((doc) => doc.data() as WithdrawalNotice)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt)),
  };
}
