import { describe, expect, it } from "vitest";

import { describeMcpAutoPermissionAction } from "./describeMcpAutoPermissionAction.js";

describe("describeMcpAutoPermissionAction", () => {
    it("discloses the exact call and external execution boundary", () => {
        expect(
            describeMcpAutoPermissionAction({
                arguments: { channel: "production" },
                server: "deployment_service",
                tool: "publish_release",
            }),
        ).toBe(
            'calling "Publish Release" from "Deployment Service" with arguments "{\\"channel\\":\\"production\\"}". Access: the MCP server can perform actions outside Rig’s filesystem sandbox',
        );
    });

    it("renders tool-controlled terminal and bidi input as visible escapes", () => {
        const action = describeMcpAutoPermissionAction({
            arguments: { value: "safe\u0007\u202emasked" },
            server: "Deployment\u001bService",
            tool: "publish\nrelease",
        });

        expect(action).toContain('calling "Publish\\nRelease"');
        expect(action).toContain('from "Deployment\\u{001b}Service"');
        expect(action).toContain("safe\\\\u0007\\u{202e}masked");
        expect(action).not.toContain("\u001b");
        expect(action).not.toContain("\u202e");
    });
});
