import { beforeEach, describe, expect, it, vi } from "vitest";

import { main } from "./main.js";
import { runApp } from "./runApp.js";
import { runExec } from "./runExec.js";
import { runLocalProtocolServer } from "../server/index.js";

vi.mock("./runApp.js", () => ({ runApp: vi.fn() }));
vi.mock("./runExec.js", () => ({ runExec: vi.fn() }));
vi.mock("../server/index.js", () => ({ runLocalProtocolServer: vi.fn() }));

describe("main command dispatch", () => {
    beforeEach(() => {
        vi.mocked(runApp).mockReset();
        vi.mocked(runExec).mockReset();
        vi.mocked(runLocalProtocolServer).mockReset();
    });

    it("starts the internal server only for its exact private invocation", async () => {
        await main(["--server"]);

        expect(runLocalProtocolServer).toHaveBeenCalledOnce();
        expect(runExec).not.toHaveBeenCalled();
        expect(runApp).not.toHaveBeenCalled();
    });

    it("treats --server after the exec separator as prompt text", async () => {
        await main(["exec", "--", "--server"]);

        expect(runExec).toHaveBeenCalledWith({
            fork: false,
            last: false,
            outputFormat: "text",
            prompt: "--server",
        });
        expect(runLocalProtocolServer).not.toHaveBeenCalled();
        expect(runApp).not.toHaveBeenCalled();
    });

    it("rejects --server as an unknown exec option", async () => {
        await expect(main(["exec", "--json", "--server"])).rejects.toThrow(
            "Unknown rig exec option '--server'.",
        );

        expect(runExec).not.toHaveBeenCalled();
        expect(runLocalProtocolServer).not.toHaveBeenCalled();
        expect(runApp).not.toHaveBeenCalled();
    });
});
