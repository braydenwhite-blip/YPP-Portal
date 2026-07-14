/** Session 5 durable domain facade. Keep domain imports here rather than importing the legacy Session 4 aggregate directly. */
export { createWaitlistOffer, acceptStaffWaitlistOffer, declineWaitlistOffer, expireWaitlistOffers } from "@/lib/session-4-operations";
