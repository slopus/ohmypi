import { agentTool } from "../Agent.js";
import {
    claudeAskUserQuestionTool,
    claudeBashTool,
    claudeEditTool,
    claudeGlobTool,
    claudeGrepTool,
    claudeReadTool,
    claudeSendMessageTool,
    claudeTaskOutputTool,
    claudeTaskStopTool,
    claudeWebFetchTool,
    claudeWebSearchTool,
    claudeWriteTool,
} from "../claude/index.js";
import {
    KIMI_AGENT_DESCRIPTION,
    KIMI_ASK_USER_QUESTION_DESCRIPTION,
    KIMI_BASH_DESCRIPTION,
    KIMI_EDIT_DESCRIPTION,
    KIMI_FETCH_URL_DESCRIPTION,
    KIMI_GLOB_DESCRIPTION,
    KIMI_GREP_DESCRIPTION,
    KIMI_READ_DESCRIPTION,
    KIMI_SEND_MESSAGE_DESCRIPTION,
    KIMI_TASK_OUTPUT_DESCRIPTION,
    KIMI_TASK_STOP_DESCRIPTION,
    KIMI_WEB_SEARCH_DESCRIPTION,
    KIMI_WRITE_DESCRIPTION,
} from "./kimiToolDescriptions.js";
import { withKimiToolContract } from "./withKimiToolContract.js";
import { kimiTodoListTool } from "./TodoList.js";

export { kimiGoalTools } from "./goals.js";
export { kimiTodoListTool } from "./TodoList.js";

export const kimiAgentTool = withKimiToolContract(agentTool, {
    argumentDescriptions: {
        context:
            "Use task for an isolated, fully briefed child; use parent only when substantial conversation context is required.",
        description: "Short, human-readable description of the delegated task.",
        effort: "Optional child effort level. Use one of the selected model's allowed effort levels from the system prompt.",
        model: "Optional child model ID. Provide together with provider.",
        prompt: "Complete task brief for the child, including known paths, constraints, and expected deliverable.",
        provider: "Optional child provider ID. Provide together with model.",
        run_in_background:
            "Run independently in the background. Omit when the next step needs the result.",
    },
    description: KIMI_AGENT_DESCRIPTION,
});

export const kimiSendMessageTool = withKimiToolContract(claudeSendMessageTool, {
    argumentDescriptions: {
        effort: "Optional new effort level. Use one of the subagent model's allowed levels from the system prompt.",
        message: "Complete follow-up instructions for the retained subagent.",
        summary: "Optional short human-readable summary of the follow-up.",
        to: "Target subagent task name, full path, or agent id.",
    },
    description: KIMI_SEND_MESSAGE_DESCRIPTION,
});

export const kimiTaskOutputTool = withKimiToolContract(claudeTaskOutputTool, {
    argumentDescriptions: {
        block: "Wait for completion. Prefer false; use true only when the user explicitly asked to wait.",
        task_id: "Background shell task or workflow ID returned by its launch tool.",
        timeout: "Maximum wait in milliseconds when block is true.",
    },
    description: KIMI_TASK_OUTPUT_DESCRIPTION,
});

export const kimiBashTool = withKimiToolContract(claudeBashTool, {
    argumentDescriptions: {
        command: "Shell command to execute.",
        dangerouslyDisableSandbox:
            "Request review for this one command to run outside the workspace sandbox in Auto mode.",
        description: "Short active-voice description, required for a background command.",
        run_in_background: "Start as a background task and return its task ID.",
        secrets: "IDs of attached secret bundles to inject. Omit or pass an empty array for none.",
        timeout: "Optional timeout in milliseconds.",
    },
    description: KIMI_BASH_DESCRIPTION,
});

export const kimiReadTool = withKimiToolContract(claudeReadTool, {
    argumentDescriptions: {
        file_path: "Absolute path to the file to read.",
        limit: "Maximum number of lines to return. Omit to use the 2,000-line default.",
        offset: "One-based line offset. Omit to begin at the first line.",
    },
    description: KIMI_READ_DESCRIPTION,
});

export const kimiEditTool = withKimiToolContract(claudeEditTool, {
    argumentDescriptions: {
        file_path: "Absolute path to the existing file to modify.",
        new_string: "Exact replacement text, excluding Read's line-number prefix.",
        old_string: "Exact text to replace, copied from a current Read result.",
        replace_all: "Replace every occurrence of old_string. Defaults to false.",
    },
    description: KIMI_EDIT_DESCRIPTION,
});

export const kimiWriteTool = withKimiToolContract(claudeWriteTool, {
    argumentDescriptions: {
        content: "Complete contents to write.",
        file_path: "Absolute path to the file to create or fully replace.",
    },
    description: KIMI_WRITE_DESCRIPTION,
});

export const kimiGlobTool = withKimiToolContract(claudeGlobTool, {
    argumentDescriptions: {
        path: "Directory to search. Omit to use the current working directory.",
        pattern: "Glob pattern for matching file paths.",
    },
    description: KIMI_GLOB_DESCRIPTION,
});

export const kimiGrepTool = withKimiToolContract(claudeGrepTool, {
    argumentDescriptions: {
        "-A": "Lines to show after each match in content mode.",
        "-B": "Lines to show before each match in content mode.",
        "-C": "Lines to show before and after each match in content mode.",
        "-i": "Use case-insensitive matching.",
        "-n": "Show line numbers in content mode. Defaults to true.",
        context: "Lines to show before and after each match in content mode.",
        glob: "Glob pattern restricting which files are searched.",
        head_limit: "Maximum returned lines or entries. Defaults to 250; use 0 sparingly.",
        multiline: "Allow the regular expression to match across line boundaries.",
        offset: "Skip this many result lines or entries before applying head_limit.",
        output_mode: "Return matching content, matching file paths, or per-file counts.",
        path: "File or directory to search. Omit to use the current working directory.",
        pattern: "Ripgrep regular expression to search for.",
        type: "Ripgrep file type filter such as ts, py, rust, or go.",
    },
    description: KIMI_GREP_DESCRIPTION,
});

export const kimiFetchUrlTool = withKimiToolContract(claudeWebFetchTool, {
    argumentDescriptions: {
        prompt: "Focused question to apply to the fetched page.",
        url: "Fully formed public HTTP or HTTPS URL.",
    },
    description: KIMI_FETCH_URL_DESCRIPTION,
    label: "FetchURL",
    name: "FetchURL",
});

export const kimiWebSearchTool = withKimiToolContract(claudeWebSearchTool, {
    argumentDescriptions: {
        allowed_domains: "Optional domains to include exclusively.",
        blocked_domains: "Optional domains to exclude. Do not combine with allowed_domains.",
        query: "Public web search query.",
    },
    description: KIMI_WEB_SEARCH_DESCRIPTION,
});

export const kimiTaskStopTool = withKimiToolContract(claudeTaskStopTool, {
    argumentDescriptions: {
        task_id: "Running background shell task or workflow ID to stop.",
    },
    description: KIMI_TASK_STOP_DESCRIPTION,
});

export const kimiAskUserQuestionTool = withKimiToolContract(claudeAskUserQuestionTool, {
    argumentDescriptions: {
        questions: "One to four structured questions whose answers materially affect the work.",
    },
    description: KIMI_ASK_USER_QUESTION_DESCRIPTION,
});

export const kimiCodeTools = [
    kimiTaskOutputTool,
    kimiBashTool,
    kimiReadTool,
    kimiEditTool,
    kimiWriteTool,
    kimiGlobTool,
    kimiGrepTool,
    kimiTodoListTool,
    kimiFetchUrlTool,
    kimiWebSearchTool,
    kimiTaskStopTool,
    kimiAskUserQuestionTool,
] as const;
