import { extname } from "node:path";

export function mediaTypeForPath(path: string): string {
    switch (extname(path).toLowerCase()) {
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".gif":
            return "image/gif";
        case ".webp":
            return "image/webp";
        case ".png":
        default:
            return "image/png";
    }
}
