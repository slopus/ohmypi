import type { CodeModeContentItem, CodeModeToolKind, JsonValue } from "./types.js";

export const MAX_FRAME_BYTES = 64 * 1024 * 1024;

export interface WireToolName {
    readonly name: string;
    readonly namespace: string | null;
}

export interface WireToolDefinition {
    readonly name: string;
    readonly tool_name: WireToolName;
    readonly description: string;
    readonly kind: CodeModeToolKind;
    readonly input_schema: JsonValue | null;
    readonly output_schema: JsonValue | null;
}

export interface WireNestedToolCall {
    readonly cell_id: string;
    readonly runtime_tool_call_id: string;
    readonly tool_name: WireToolName;
    readonly tool_kind: CodeModeToolKind;
    readonly input: JsonValue | null;
}

export type WireRuntimeResponse =
    | { readonly Result: WireRuntimeResponseValue & { readonly error_text: string | null } }
    | { readonly Terminated: WireRuntimeResponseValue }
    | { readonly Yielded: WireRuntimeResponseValue };

export interface WireRuntimeResponseValue {
    readonly cell_id: string;
    readonly content_items: readonly CodeModeContentItem[];
}

export type WireResult<T> =
    | { readonly status: "error"; readonly message: string }
    | { readonly status: "ok"; readonly value: T };

export type HostMessage =
    | { readonly type: "cell/closed"; readonly sessionId: string; readonly cellId: string }
    | {
          readonly type: "connection/ready";
          readonly selectedVersion: number;
          readonly capabilities: readonly string[];
      }
    | { readonly type: "connection/rejected"; readonly reason: unknown }
    | { readonly type: "delegate/cancel"; readonly id: number }
    | {
          readonly type: "delegate/request";
          readonly id: number;
          readonly sessionId: string;
          readonly request:
              | {
                    readonly type: "notification/send";
                    readonly callId: string;
                    readonly cellId: string;
                    readonly text: string;
                }
              | { readonly type: "tool/invoke"; readonly invocation: WireNestedToolCall };
      }
    | {
          readonly type: "execute/initialResponse";
          readonly id: number;
          readonly result: WireResult<WireRuntimeResponse>;
      }
    | {
          readonly type: "operation/response";
          readonly id: number;
          readonly result: WireResult<HostOperationResponse>;
      };

export type HostOperationResponse =
    | { readonly type: "execution/started"; readonly cellId: string }
    | { readonly type: "session/closed"; readonly sessionId: string }
    | { readonly type: "session/ready"; readonly sessionId: string }
    | { readonly type: "wait/completed"; readonly outcome: WireWaitOutcome };

export type WireWaitOutcome =
    | { readonly LiveCell: WireRuntimeResponse }
    | { readonly MissingCell: WireRuntimeResponse };

export type ClientMessage =
    | {
          readonly type: "connection/hello";
          readonly supportedVersions: readonly number[];
          readonly requiredCapabilities: readonly string[];
          readonly optionalCapabilities: readonly string[];
      }
    | {
          readonly type: "delegate/response";
          readonly id: number;
          readonly result: WireResult<JsonValue>;
      }
    | { readonly type: "operation/cancel"; readonly id: number }
    | {
          readonly type: "operation/request";
          readonly id: number;
          readonly request: Readonly<Record<string, unknown>>;
      };
