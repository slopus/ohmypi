import type { AutoPermissionReview } from "./parseAutoPermissionReview.js";

export function normalizeAutoPermissionReview(review: AutoPermissionReview): AutoPermissionReview {
    if (review.decision !== "allow" || review.risk !== "high") return review;
    if (review.userAuthorization === "medium" || review.userAuthorization === "high") {
        return review;
    }
    return { ...review, decision: "ask" };
}
