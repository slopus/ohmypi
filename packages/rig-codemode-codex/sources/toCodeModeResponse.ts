import type { WireRuntimeResponse } from "./protocol.js";
import type { CodeModeResponse } from "./types.js";

export function toCodeModeResponse(response: WireRuntimeResponse): CodeModeResponse {
    if ("Yielded" in response) {
        return {
            state: "yielded",
            cellId: response.Yielded.cell_id,
            contentItems: response.Yielded.content_items,
        };
    }
    if ("Terminated" in response) {
        return {
            state: "terminated",
            cellId: response.Terminated.cell_id,
            contentItems: response.Terminated.content_items,
        };
    }
    const result = response.Result;
    return result.error_text === null
        ? { state: "result", cellId: result.cell_id, contentItems: result.content_items }
        : {
              state: "result",
              cellId: result.cell_id,
              contentItems: result.content_items,
              errorText: result.error_text,
          };
}
