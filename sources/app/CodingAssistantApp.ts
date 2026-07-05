import { createId } from "@paralleldrive/cuid2";
import { homedir } from "node:os";
import { basename } from "node:path";
import {
  CURSOR_MARKER,
  Editor,
  matchesKey,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
  type Component,
  type EditorTheme,
  type Focusable,
  type TUI,
} from "@earendil-works/pi-tui";

import {
  type Agent,
  type AgentLoopEvent,
  type Message,
  type ToolResultBlock,
} from "../agent/index.js";
import type { NativeProxessManager } from "../processes/index.js";
import type { AppTranscriptEntry } from "./AppTranscriptEntry.js";
import { renderAgentMarkdown } from "./renderAgentMarkdown.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const NOT_BOLD_OR_DIM = "\x1b[22m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const OH_MY_PI_ORANGE = "\x1b[38;5;202m";
const CURSOR_BG = "\x1b[48;5;244m";
const CURSOR_FG = "\x1b[38;5;232m";
const SURFACE_BG = "\x1b[48;5;236m";
const SURFACE_FG = "\x1b[38;5;252m";
const INPUT_FG = "\x1b[38;5;255m";
const SURFACE_MUTED_FG = "\x1b[38;5;245m";
const FOOTER_MODEL_FG = "\x1b[38;5;252m";
const FOOTER_CWD_FG = "\x1b[38;5;245m";
const FOOTER_QUEUED_FG = "\x1b[38;5;246m";
const INPUT_PLACEHOLDER = "Ask Oh My Pi to do anything";
const INPUT_PROMPT = "› ";
const INPUT_LINE_INDENT = "  ";
const CURSOR_BLINK_MS = 530;
const CURSOR_TYPING_DEBOUNCE_MS = 530;
const REASONING_DOWN_RAW_KEYS = new Set(["\x1b,", "\x1b[1;2B"]);
const REASONING_UP_RAW_KEYS = new Set(["\x1b.", "\x1b[1;2A"]);

const EDITOR_THEME: EditorTheme = {
  borderColor: (text) => text,
  selectList: {
    selectedPrefix: (text) => text,
    selectedText: (text) => text,
    description: (text) => text,
    scrollInfo: (text) => text,
    noMatch: (text) => text,
  },
};

const MAX_TRANSCRIPT_ENTRIES = 500;

export interface CodingAssistantAppOptions {
  agent: Agent;
  cwd: string;
  processManager: NativeProxessManager;
  tui: TUI;
  idFactory?: () => string;
  onExit?: () => void | Promise<void>;
  version?: string;
}

export class CodingAssistantApp implements Component, Focusable {
  readonly #agent: Agent;
  readonly #cwd: string;
  readonly #idFactory: () => string;
  readonly #editor: Editor;
  readonly #onExit: (() => void | Promise<void>) | undefined;
  readonly #processManager: NativeProxessManager;
  readonly #tui: TUI;
  readonly #version: string;
  readonly #exitPromise: Promise<void>;

  #abortController: AbortController | undefined;
  #abortNotified = false;
  #activeRun: Promise<void> | undefined;
  #cursorBlinkTimer: ReturnType<typeof setInterval> | undefined;
  #cursorTyping = false;
  #cursorTypingDebounceTimer: ReturnType<typeof setTimeout> | undefined;
  #cursorVisible = true;
  #entries: AppTranscriptEntry[] = [];
  #exiting = false;
  #exitResolve: (() => void) | undefined;
  #focused = false;
  #pendingPrompts: string[] = [];
  #running = false;
  #seenToolCallIds = new Set<string>();
  #statusText = "Idle";
  #stopped = false;
  #streamEntryId: string | undefined;

  constructor(options: CodingAssistantAppOptions) {
    this.#agent = options.agent;
    this.#cwd = options.cwd;
    this.#idFactory = options.idFactory ?? createId;
    this.#onExit = options.onExit;
    this.#processManager = options.processManager;
    this.#tui = options.tui;
    this.#version = options.version ?? "0.0.0";
    this.#editor = new Editor(this.#tui, EDITOR_THEME, { paddingX: 0 });
    this.#exitPromise = new Promise((resolve) => {
      this.#exitResolve = resolve;
    });

    this.#editor.onSubmit = (value) => {
      this.#submit(value);
    };
  }

  get focused(): boolean {
    return this.#focused;
  }

  set focused(value: boolean) {
    this.#focused = value;
    this.#editor.focused = value;
    this.#cursorVisible = true;
    if (value) {
      this.#cursorTyping = false;
      this.#startCursorBlink();
    } else {
      this.#stopCursorBlink();
    }
  }

  start(): void {
    this.#tui.addChild(this);
    this.focused = true;
    this.#tui.setFocus(this);
    this.#tui.start();
    this.#requestRender();
  }

  async stop(): Promise<void> {
    if (this.#stopped || this.#exiting) {
      return;
    }

    this.#exiting = true;
    this.#statusText = "Stopped";
    this.#abortController?.abort();
    this.#stopCursorBlink();
    this.#editor.setText("");
    this.#requestRender();
    await this.#waitForShutdownRender();

    this.#stopped = true;
    this.#tui.stop();

    try {
      await this.#processManager.killAll({ forceAfterMs: 500 });
      await this.#onExit?.();
    } finally {
      this.#exitResolve?.();
      this.#requestRender();
    }
  }

  waitForExit(): Promise<void> {
    return this.#exitPromise;
  }

  async waitForIdle(): Promise<void> {
    for (;;) {
      const activeRun = this.#activeRun;
      if (activeRun === undefined) {
        return;
      }

      await activeRun;
    }
  }

  handleInput(data: string): void {
    if (this.#stopped || this.#exiting) {
      return;
    }

    if (matchesKey(data, "ctrl+c") || data === "\x03") {
      void this.stop();
      return;
    }

    if (matchesKey(data, "ctrl+d") && this.#editor.getText().length === 0) {
      void this.stop();
      return;
    }

    if (matchesKey(data, "escape")) {
      this.#markTypingActivity();
      this.#handleEscape();
      this.#requestRender();
      return;
    }

    if (this.#handleReasoningShortcut(data)) {
      this.#requestRender();
      return;
    }

    this.#markTypingActivity();
    this.#editor.handleInput(data);
    this.#requestRender();
  }

  invalidate(): void {
    this.#editor.invalidate();
  }

  render(width: number): string[] {
    const safeWidth = Math.max(20, width);
    const header = this.#renderHeader(safeWidth);
    const footer = this.#renderFooter(safeWidth);
    const input = this.#renderInput(safeWidth);

    if (this.#exiting) {
      return [
        ...header,
        ...this.#renderTranscript(safeWidth),
      ];
    }

    return [
      ...header,
      ...this.#renderTranscript(safeWidth),
      "",
      ...input,
      ...footer,
      "",
      "",
    ];
  }

  #submit(value: string): void {
    const prompt = value.trim();
    if (prompt.length === 0) {
      return;
    }

    this.#editor.setText("");
    if (this.#handleCommand(prompt)) {
      this.#requestRender();
      return;
    }

    this.#appendEntry({ role: "user", text: prompt });
    if (this.#running) {
      this.#appendEntry({
        role: "event",
        title: "queue",
        text: `Queued behind the active run.`,
      });
    }

    this.#pendingPrompts.push(prompt);
    this.#startDrainQueue();
    this.#requestRender();
  }

  #handleCommand(prompt: string): boolean {
    if (prompt === "/exit" || prompt === "/quit") {
      void this.stop();
      return true;
    }

    if (prompt === "/clear") {
      this.#entries = [];
      this.#streamEntryId = undefined;
      this.#appendEntry({ role: "system", text: "Transcript cleared." });
      return true;
    }

    if (prompt === "/abort") {
      if (this.#running && this.#abortController !== undefined) {
        this.#abortController.abort();
        this.#statusText = "Aborting";
        this.#appendAbortNotice();
      } else {
        this.#appendEntry({
          role: "event",
          title: "abort",
          text: "No active run.",
        });
      }
      return true;
    }

    return false;
  }

  #startDrainQueue(): void {
    if (this.#activeRun !== undefined) {
      return;
    }

    this.#activeRun = this.#drainQueue().finally(() => {
      this.#activeRun = undefined;
      this.#requestRender();
    });
  }

  async #drainQueue(): Promise<void> {
    while (!this.#stopped) {
      const prompt = this.#pendingPrompts.shift();
      if (prompt === undefined) {
        break;
      }

      await this.#runPrompt(prompt);
    }
  }

  async #runPrompt(prompt: string): Promise<void> {
    const controller = new AbortController();
    this.#abortController = controller;
    this.#abortNotified = false;
    this.#running = true;
    this.#statusText = "Running";
    this.#streamEntryId = undefined;
    this.#requestRender();

    try {
      const result = await this.#agent.send(prompt, {
        signal: controller.signal,
        onEvent: (event) => this.#handleAgentEvent(event),
        onMessage: (message) => this.#handleAgentMessage(message),
      });

      this.#statusText =
        result.stopReason === "stop" ? "Idle" : `Stopped: ${result.stopReason}`;
      if (result.stopReason === "aborted") {
        this.#appendAbortNotice();
      }
    } catch (error) {
      if (controller.signal.aborted) {
        this.#statusText = "Idle";
        this.#appendAbortNotice();
      } else {
        this.#statusText = "Error";
        this.#appendEntry({ role: "error", text: this.#formatError(error) });
      }
    } finally {
      if (this.#abortController === controller) {
        this.#abortController = undefined;
      }
      this.#running = false;
      this.#streamEntryId = undefined;
      this.#requestRender();
    }
  }

  #handleEscape(): void {
    if (this.#running && this.#abortController !== undefined) {
      this.#statusText = "Aborting";
      this.#abortController.abort();
      this.#appendAbortNotice();
      return;
    }

    void this.stop();
  }

  #handleAgentEvent(event: AgentLoopEvent): void {
    if (this.#stopped) {
      return;
    }

    if (event.type === "inference_iteration_start") {
      this.#statusText = "Running";
      this.#streamEntryId = undefined;
      if (event.iteration > 1) {
        this.#appendEntry({ role: "separator", text: "" });
      }
    } else if (event.type === "text_start") {
      this.#statusText = "Running";
    } else if (event.type === "text_delta") {
      this.#appendStreamText(event.delta);
    } else if (event.type === "text_end") {
      this.#finishStreamText(event.content);
    } else if (event.type === "thinking_start") {
      this.#statusText = "Thinking";
    } else if (event.type === "toolcall_end") {
      this.#seenToolCallIds.add(event.toolCall.id);
      this.#statusText = `Calling ${event.toolCall.name}`;
      this.#appendEntry({
        id: event.toolCall.id,
        role: "tool",
        title: event.toolCall.name,
        text: this.#formatToolCall(event.toolCall.name, event.toolCall.arguments),
      });
    } else if (event.type === "done") {
      this.#statusText = event.reason === "toolUse" ? "Running tools" : "Idle";
    } else if (event.type === "error") {
      this.#statusText = "Error";
      this.#appendEntry({
        role: "error",
        text: event.error.errorMessage ?? "Provider returned an error.",
      });
    }

    this.#requestRender();
  }

  #appendAbortNotice(): void {
    if (this.#abortNotified) {
      return;
    }

    this.#abortNotified = true;
    this.#appendEntry({ role: "event", title: "abort", text: "Run aborted." });
  }

  #handleAgentMessage(message: Message): void {
    if (message.role !== "agent") {
      return;
    }

    const text = message.blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
    if (text.length > 0) {
      this.#finishAssistantMessage(message.id, text);
    }

    for (const block of message.blocks) {
      if (block.type === "tool_call" && !this.#seenToolCallIds.has(block.id)) {
        this.#seenToolCallIds.add(block.id);
        this.#appendEntry({
          id: block.id,
          role: "tool",
          title: block.name,
          text: this.#formatToolCall(block.name, block.arguments),
        });
      } else if (block.type === "tool_result") {
        this.#finishToolResult(block);
      }
    }

    this.#requestRender();
  }

  #ensureStreamEntry(): AppTranscriptEntry {
    const existing = this.#streamEntryId === undefined
      ? undefined
      : this.#entries.find((entry) => entry.id === this.#streamEntryId);
    if (existing !== undefined) {
      return existing;
    }

    const entry = this.#appendEntry({ role: "assistant", text: "" });
    this.#streamEntryId = entry.id;
    return entry;
  }

  #appendStreamText(delta: string): void {
    const entry = this.#ensureStreamEntry();
    entry.text += delta;
  }

  #finishStreamText(text: string): void {
    const entry = this.#ensureStreamEntry();
    entry.text = text;
  }

  #finishAssistantMessage(messageId: string, text: string): void {
    if (this.#streamEntryId !== undefined) {
      const entry = this.#entries.find((candidate) => candidate.id === this.#streamEntryId);
      if (entry !== undefined) {
        entry.id = messageId;
        entry.text = text;
        this.#streamEntryId = undefined;
        return;
      }
    }

    this.#appendEntry({ id: messageId, role: "assistant", text });
  }

  #appendEntry(
    entry: Omit<AppTranscriptEntry, "id"> & { id?: string },
  ): AppTranscriptEntry {
    const completeEntry: AppTranscriptEntry = {
      id: entry.id ?? this.#idFactory(),
      role: entry.role,
      text: entry.text,
    };
    if (entry.detail !== undefined) {
      completeEntry.detail = entry.detail;
    }
    if (entry.title !== undefined) {
      completeEntry.title = entry.title;
    }

    this.#entries.push(completeEntry);
    if (this.#entries.length > MAX_TRANSCRIPT_ENTRIES) {
      this.#entries = this.#entries.slice(-MAX_TRANSCRIPT_ENTRIES);
    }
    this.#requestRender();
    return completeEntry;
  }

  #renderHeader(width: number): string[] {
    const model = `${this.#modelDisplayName()} (${this.#agent.model.id})`;
    const provider = this.#agent.provider.id;
    return [
      ...this.#renderStartupBox(width, [
        `${OH_MY_PI_ORANGE}>_${RESET} ${BOLD}Oh My Pi${NOT_BOLD_OR_DIM} ${this.#version}`,
        `Model: ${model}`,
        `Provider: ${provider}`,
        `Directory: ${this.#directoryName()}`,
      ]),
      "",
    ];
  }

  #renderTranscript(width: number): string[] {
    const sourceEntries = this.#entries.length === 0
      ? [{ id: "ready", role: "system" as const, text: "Ready." }]
      : this.#entries;
    const lines: string[] = [];

    for (const entry of sourceEntries) {
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(...this.#renderEntry(entry, width));
    }

    const activity = this.#activityText();
    if (activity !== undefined && this.#shouldRenderActivityAsLastMessage()) {
      if (lines.length > 0) {
        lines.push("");
      }
      lines.push(...this.#renderActivityLine(activity, width));
    }

    return lines;
  }

  #renderEntry(entry: AppTranscriptEntry, width: number): string[] {
    if (entry.role === "separator") {
      return [this.#turnSeparator(width)];
    }
    if (entry.role === "user") {
      return this.#renderUserEntry(entry, width);
    }
    if (entry.role === "assistant") {
      return this.#renderAssistantEntry(entry, width);
    }
    if (entry.role === "tool") {
      return this.#renderToolEntry(entry, width, false);
    }
    if (entry.role === "error") {
      return entry.title === undefined
        ? this.#renderNoticeEntry("Error", entry.text, width, RED)
        : this.#renderToolEntry(entry, width, true);
    }
    if (entry.role === "event") {
      return this.#renderNoticeEntry(entry.title ?? "event", entry.text, width, YELLOW);
    }

    return this.#renderNoticeEntry("system", entry.text, width, SURFACE_MUTED_FG);
  }

  #renderFooter(width: number): string[] {
    const parts = [`${FOOTER_MODEL_FG}${this.#modelWithReasoningDisplayName()}${RESET}`];
    parts.push(`${FOOTER_CWD_FG}${this.#cwdDisplayName()}${RESET}`);
    if (this.#pendingPrompts.length > 0) {
      parts.push(`${FOOTER_QUEUED_FG}queued ${this.#pendingPrompts.length}${RESET}`);
    }

    const line = `${" ".repeat(visibleWidth(INPUT_PROMPT))}${parts.join(`${DIM} • ${RESET}`)}`;
    return [this.#fitLine(line, width)];
  }

  #renderInput(width: number): string[] {
    return [
      this.#surfaceLine("", width),
      ...this.#renderInputContent(width),
      this.#surfaceLine("", width),
    ];
  }

  #renderInputContent(width: number): string[] {
    if (this.#editor.getText().length === 0) {
      return [this.#inputSurfaceLine(this.#emptyInputLine(), width)];
    }

    const promptWidth = visibleWidth(INPUT_PROMPT);
    const editorWidth = Math.max(1, width - promptWidth);
    const contentLines = this.#stripSpuriousLeadingEmptyLine(
      this.#stripEditorChrome(this.#editor.render(editorWidth)),
    );

    return contentLines.map((line, index) => {
      const prefix = index === 0 ? this.#inputPrompt() : INPUT_LINE_INDENT;
      const rendered = `${prefix}${line}`;
      return this.#inputSurfaceLine(
        this.#cursorVisible ? rendered : this.#hideCursor(rendered),
        width,
      );
    });
  }

  #finishToolResult(block: ToolResultBlock): void {
    const existing = this.#entries.find((entry) => entry.id === block.toolCallId);
    const detail = this.#formatToolResult(block);
    if (existing !== undefined) {
      existing.role = block.isError ? "error" : "tool";
      existing.title = block.toolName;
      existing.detail = detail;
      return;
    }

    this.#appendEntry({
      id: block.toolCallId,
      role: block.isError ? "error" : "tool",
      title: block.toolName,
      text: block.toolName,
      detail,
    });
  }

  #formatToolCall(toolName: string, args: unknown): string {
    const record = this.#isRecord(args) ? args : {};
    const stringField = (key: string): string | undefined => {
      const value = record[key];
      return typeof value === "string" && value.length > 0 ? value : undefined;
    };

    const normalized = toolName.toLowerCase();
    const command = stringField("cmd") ?? stringField("command");
    if (command !== undefined) {
      return this.#singleLine(command);
    }

    const path = stringField("file_path") ?? stringField("path");
    if (path !== undefined) {
      return this.#singleLine(path);
    }

    const pattern = stringField("pattern");
    if (pattern !== undefined) {
      return this.#singleLine(pattern);
    }

    const query = stringField("query");
    if (query !== undefined) {
      return this.#singleLine(query);
    }

    if (normalized === "todowrite") {
      const todos = record.todos;
      return Array.isArray(todos) ? `${todos.length} todo${todos.length === 1 ? "" : "s"}` : "todos";
    }

    return toolName;
  }

  #formatToolResult(block: ToolResultBlock): string {
    return this.#singleLine(block.display.length > 0 ? block.display : "(empty result)");
  }

  #formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  #fitLine(line: string, width: number): string {
    return truncateToWidth(line, width, "", true);
  }

  #truncateLine(line: string, width: number): string {
    return truncateToWidth(line, width, "", false);
  }

  #renderStartupBox(width: number, rows: string[]): string[] {
    const maxInnerWidth = Math.max(1, width - 4);
    const contentWidth = rows
      .map((row) => visibleWidth(row))
      .reduce((maxWidth, rowWidth) => Math.max(maxWidth, rowWidth), 1);
    const innerWidth = Math.min(maxInnerWidth, contentWidth);
    const rule = "─".repeat(innerWidth + 2);
    const top = `╭${rule}╮`;
    const bottom = `╰${rule}╯`;
    return [
      this.#truncateLine(`${DIM}${top}${RESET}`, width),
      ...rows.map((row) => {
        const paddedText = this.#fitAndPadLine(row, innerWidth);
        return this.#truncateLine(
          `${DIM}│ ${NOT_BOLD_OR_DIM}${paddedText}${DIM} │${RESET}`,
          width,
        );
      }),
      this.#truncateLine(`${DIM}${bottom}${RESET}`, width),
    ];
  }

  #renderUserEntry(entry: AppTranscriptEntry, width: number): string[] {
    const prefix = `${BOLD}›${NOT_BOLD_OR_DIM} `;
    const prefixWidth = visibleWidth(prefix);
    const contentWidth = Math.max(1, width - prefixWidth);
    const wrapped = wrapTextWithAnsi(entry.text.length === 0 ? " " : entry.text, contentWidth);
    const indent = " ".repeat(prefixWidth);
    return [
      this.#surfaceLine("", width),
      ...wrapped.map((line, index) =>
        this.#inputSurfaceLine(`${index === 0 ? prefix : indent}${line}`, width),
      ),
      this.#surfaceLine("", width),
    ];
  }

  #renderAssistantEntry(entry: AppTranscriptEntry, width: number): string[] {
    const prefix = `${DIM}•${RESET} `;
    const prefixWidth = visibleWidth(prefix);
    const contentWidth = Math.max(1, width - prefixWidth);
    const renderedMarkdown = renderAgentMarkdown({
      text: entry.text,
      width: contentWidth,
      cwd: this.#cwd,
    });
    const indent = " ".repeat(prefixWidth);
    return renderedMarkdown.map((line, index) =>
      this.#fitLine(`${index === 0 ? prefix : indent}${line}`, width),
    );
  }

  #renderToolEntry(entry: AppTranscriptEntry, width: number, isError: boolean): string[] {
    const toolName = entry.title ?? "tool";
    const verb = isError ? "Failed" : this.#toolVerb(toolName);
    const dot = isError ? RED : GREEN;
    const callText = this.#singleLine(entry.text);
    const titleSuffix = callText.length > 0 && callText !== toolName
      ? ` ${CYAN}${callText}${RESET}`
      : ` ${CYAN}${toolName}${RESET}`;
    const title = `${dot}•${RESET} ${OH_MY_PI_ORANGE}${BOLD}${verb}${NOT_BOLD_OR_DIM}${titleSuffix}`;
    const lines = [this.#fitLine(title, width)];
    if (entry.detail !== undefined) {
      const detailText = entry.detail.length > 0 ? entry.detail : "(empty result)";
      lines.push(this.#fitLine(`  ${DIM}└${RESET} ${DIM}${detailText}${RESET}`, width));
    }
    return lines;
  }

  #renderNoticeEntry(
    title: string,
    text: string,
    width: number,
    color: string,
  ): string[] {
    const prefix = `${color}•${RESET} ${BOLD}${title}${NOT_BOLD_OR_DIM} `;
    const prefixWidth = visibleWidth(prefix);
    const wrapped = wrapTextWithAnsi(text.length === 0 ? " " : text, Math.max(1, width - prefixWidth));
    const indent = " ".repeat(prefixWidth);
    return wrapped.map((line, index) =>
      this.#fitLine(`${index === 0 ? prefix : indent}${line}`, width),
    );
  }

  #emptyInputLine(): string {
    const marker = this.#focused ? CURSOR_MARKER : "";
    return `${this.#inputPrompt()}${marker}${SURFACE_MUTED_FG}${INPUT_PLACEHOLDER}${INPUT_FG}`;
  }

  #surfaceLine(line: string, width: number): string {
    return `${SURFACE_BG}${SURFACE_FG}${this.#fitAndPadLine(line, width)}${RESET}`;
  }

  #inputSurfaceLine(line: string, width: number): string {
    const softened = this.#softenFakeCursor(line);
    return `${SURFACE_BG}${INPUT_FG}${this.#fitAndPadLine(this.#restoreInputSurface(softened), width)}${RESET}`;
  }

  #restoreInputSurface(line: string): string {
    return line.replaceAll(RESET, `${RESET}${SURFACE_BG}${INPUT_FG}`);
  }

  #softenFakeCursor(line: string): string {
    return line.replace(
      /\x1b\[7m([\s\S]*?)\x1b\[(?:27|0)m/gu,
      `${CURSOR_BG}${CURSOR_FG}$1${SURFACE_BG}${INPUT_FG}`,
    );
  }

  #activityText(): string | undefined {
    if (this.#statusText === "Idle") {
      return undefined;
    }
    if (this.#statusText === "Running") {
      return "Working";
    }
    if (this.#statusText.startsWith("Stopped:")) {
      return undefined;
    }

    return this.#statusText;
  }

  #shouldRenderActivityAsLastMessage(): boolean {
    if (this.#streamEntryId !== undefined) {
      return false;
    }

    const lastEntry = this.#entries.at(-1);
    return lastEntry === undefined
      || lastEntry.role === "separator"
      || lastEntry.role === "user"
      || lastEntry.role === "system";
  }

  #renderActivityLine(text: string, width: number): string[] {
    const prefix = `${OH_MY_PI_ORANGE}•${RESET} `;
    const prefixWidth = visibleWidth(prefix);
    const wrapped = wrapTextWithAnsi(text, Math.max(1, width - prefixWidth));
    const indent = " ".repeat(prefixWidth);
    return wrapped.map((line, index) =>
      this.#fitLine(`${index === 0 ? prefix : indent}${line}`, width),
    );
  }

  #hideCursor(line: string): string {
    return line.replace(/\x1b\[7m([\s\S]*?)\x1b\[(?:27|0)m/gu, "$1");
  }

  #fitAndPadLine(line: string, width: number): string {
    const fitted = truncateToWidth(line, width, "", false);
    const padding = " ".repeat(Math.max(0, width - visibleWidth(fitted)));
    return `${fitted}${padding}`;
  }

  #turnSeparator(width: number): string {
    return this.#fitLine(`${DIM}${"─".repeat(width)}${RESET}`, width);
  }

  #directoryName(): string {
    return basename(this.#cwd) || this.#cwd;
  }

  #inputPrompt(): string {
    return `${OH_MY_PI_ORANGE}${BOLD}›${NOT_BOLD_OR_DIM}${INPUT_FG} `;
  }

  #handleReasoningShortcut(data: string): boolean {
    const direction = this.#reasoningShortcutDirection(data);
    if (direction === undefined) {
      return false;
    }

    const nextEffort = this.#nextReasoningEffort(direction);
    if (nextEffort !== undefined) {
      this.#agent.setEffort(nextEffort);
    }

    return true;
  }

  #reasoningShortcutDirection(data: string): "down" | "up" | undefined {
    if (
      REASONING_DOWN_RAW_KEYS.has(data)
      || matchesKey(data, "alt+,")
      || matchesKey(data, "shift+down")
    ) {
      return "down";
    }
    if (
      REASONING_UP_RAW_KEYS.has(data)
      || matchesKey(data, "alt+.")
      || matchesKey(data, "shift+up")
    ) {
      return "up";
    }

    return undefined;
  }

  #nextReasoningEffort(direction: "down" | "up"): string | undefined {
    const choices = [...this.#agent.model.thinkingLevels];
    if (choices.length === 0) {
      return undefined;
    }

    const firstChoice = choices[0];
    if (firstChoice === undefined) {
      return undefined;
    }

    const snapshotEffort = this.#agent.snapshot().effort;
    const fallbackEffort = this.#agent.model.defaultThinkingLevel;
    const currentEffort = snapshotEffort !== undefined && choices.includes(snapshotEffort)
      ? snapshotEffort
      : choices.includes(fallbackEffort)
        ? fallbackEffort
        : firstChoice;
    const currentIndex = choices.indexOf(currentEffort);
    const nextIndex = direction === "up" ? currentIndex + 1 : currentIndex - 1;

    return choices[nextIndex];
  }

  #modelDisplayName(): string {
    return this.#agent.model.id.split("/").at(-1) ?? this.#agent.model.id;
  }

  #modelWithReasoningDisplayName(): string {
    const effort = this.#agent.snapshot().effort ?? this.#agent.model.defaultThinkingLevel;
    return effort === undefined
      ? this.#modelDisplayName()
      : `${this.#modelDisplayName()}-${effort}`;
  }

  #cwdDisplayName(): string {
    const home = homedir();
    if (this.#cwd === home) {
      return "~";
    }
    if (this.#cwd.startsWith(`${home}/`)) {
      return `~/${this.#cwd.slice(home.length + 1)}`;
    }

    return this.#cwd;
  }

  #toolVerb(toolName: string): string {
    const normalized = toolName.toLowerCase();
    if (normalized.includes("bash") || normalized.includes("exec")) {
      return "Ran";
    }
    if (
      normalized.includes("grep")
      || normalized.includes("find")
      || normalized.includes("glob")
      || normalized === "ls"
    ) {
      return "Explored";
    }
    if (normalized.includes("read") || normalized.includes("view")) {
      return "Read";
    }
    if (
      normalized.includes("write")
      || normalized.includes("edit")
      || normalized.includes("patch")
    ) {
      return "Edited";
    }

    return "Used";
  }

  #isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  #singleLine(text: string): string {
    return text.replace(/\s+/gu, " ").trim();
  }

  #markTypingActivity(): void {
    this.#cursorTyping = true;
    this.#cursorVisible = true;

    if (this.#cursorTypingDebounceTimer !== undefined) {
      clearTimeout(this.#cursorTypingDebounceTimer);
    }

    this.#cursorTypingDebounceTimer = setTimeout(() => {
      this.#cursorTypingDebounceTimer = undefined;
      this.#cursorTyping = false;
    }, CURSOR_TYPING_DEBOUNCE_MS);
    this.#cursorTypingDebounceTimer.unref?.();
  }

  #stripEditorChrome(lines: string[]): string[] {
    let content = [...lines];

    while (content.length > 0 && this.#isEditorBorderLine(content[0] ?? "")) {
      content = content.slice(1);
    }
    while (content.length > 0 && this.#isEditorBorderLine(content[content.length - 1] ?? "")) {
      content = content.slice(0, -1);
    }

    return content.filter((line) => !line.includes(" more "));
  }

  #isEditorBorderLine(line: string): boolean {
    const stripped = line.replace(/\x1b\[[0-9;]*m/g, "");
    return stripped.length > 0 && [...stripped].every((character) => character === "─");
  }

  #stripSpuriousLeadingEmptyLine(lines: string[]): string[] {
    if (lines.length <= 1) {
      return lines;
    }

    const first = lines[0] ?? "";
    if (this.#isVisibleEditorLine(first)) {
      return lines;
    }

    return lines.slice(1);
  }

  #isVisibleEditorLine(line: string): boolean {
    const stripped = line
      .replace(/\x1b\[[0-9;]*m/g, "")
      .replaceAll(CURSOR_MARKER, "")
      .trim();
    return stripped.length > 0 || line.includes("\x1b[7m") || line.includes(CURSOR_MARKER);
  }

  #startCursorBlink(): void {
    if (this.#cursorBlinkTimer !== undefined || this.#stopped) {
      return;
    }

    this.#cursorBlinkTimer = setInterval(() => {
      if (!this.#focused || this.#stopped || this.#cursorTyping) {
        return;
      }

      this.#cursorVisible = !this.#cursorVisible;
      this.#requestRender();
    }, CURSOR_BLINK_MS);
    this.#cursorBlinkTimer.unref?.();
  }

  #stopCursorBlink(): void {
    if (this.#cursorTypingDebounceTimer !== undefined) {
      clearTimeout(this.#cursorTypingDebounceTimer);
      this.#cursorTypingDebounceTimer = undefined;
    }

    this.#cursorTyping = false;

    if (this.#cursorBlinkTimer === undefined) {
      return;
    }

    clearInterval(this.#cursorBlinkTimer);
    this.#cursorBlinkTimer = undefined;
    this.#cursorVisible = true;
  }

  #requestRender(): void {
    if (!this.#stopped) {
      this.#tui.requestRender();
    }
  }

  #waitForShutdownRender(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }
}
