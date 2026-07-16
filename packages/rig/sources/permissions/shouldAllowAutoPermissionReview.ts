import type { AutoPermissionReview } from "./parseAutoPermissionReview.js";

export function shouldAllowAutoPermissionReview(review: AutoPermissionReview): boolean {
    return (
        review.decision === "allow" &&
        (review.risk !== "high" || review.userAuthorization !== "low")
    );
}
