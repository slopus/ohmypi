import { truncateToWidth } from "@earendil-works/pi-tui";

import { renderRigVersion } from "./renderRigVersion.js";

const RESET = "\x1b[0m";
const RIG_LOGO = [
    "██████╗ ██╗ ██████╗",
    "██╔══██╗██║██╔════╝",
    "██████╔╝██║██║  ███╗",
    "██╔══██╗██║██║   ██║",
    "██║  ██║██║╚██████╔╝",
    "╚═╝  ╚═╝╚═╝ ╚═════╝",
] as const;
const RIG_LOGO_WIDTH = 20;
const BANNER_GAP = "  ";
const BANNER_PADDING = "  ";

export function renderRigBanner(options: {
    brand: string;
    secondary: string;
    version: string;
    width: number;
}): string[] {
    const width = Math.max(1, options.width);
    const contentWidth = width - BANNER_PADDING.length * 2;
    if (contentWidth <= 0) return [" ".repeat(width)];

    if (contentWidth < RIG_LOGO_WIDTH + BANNER_GAP.length + options.version.length) {
        const lines = [
            truncateToWidth(
                `${options.brand}Rig${RESET} ${options.secondary}${options.version}${RESET}`,
                contentWidth,
                "",
                false,
            ),
        ];
        return padBannerLines(lines);
    }

    const versionWidth = contentWidth - RIG_LOGO_WIDTH - BANNER_GAP.length;
    const versionLines = renderRigVersion(options.version, versionWidth);
    if (versionLines.length === RIG_LOGO.length) {
        const lines = RIG_LOGO.map(
            (line, index) =>
                `${options.brand}${line.padEnd(RIG_LOGO_WIDTH)}${RESET}${BANNER_GAP}${options.secondary}${versionLines[index]}${RESET}`,
        );
        return padBannerLines(lines);
    }

    const lines = RIG_LOGO.map((line, index) => {
        const version =
            index === RIG_LOGO.length - 1
                ? `${BANNER_GAP}${options.secondary}${versionLines[0]}${RESET}`
                : "";
        return `${options.brand}${line.padEnd(RIG_LOGO_WIDTH)}${RESET}${version}`;
    });
    return padBannerLines(lines);
}

function padBannerLines(lines: string[]): string[] {
    return lines.map((line) => `${BANNER_PADDING}${line}${BANNER_PADDING}`);
}
