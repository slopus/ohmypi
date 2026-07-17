export const KIMI_AGENT_DESCRIPTION = `Launch a subagent to handle a substantial, focused task. The subagent has its own context, which keeps intermediate file contents and command output out of your context; you receive its conclusion when it finishes.

Writing the prompt:
- With context="task", the subagent starts with only the delegated prompt. Brief it like a colleague who just arrived: state the goal, relevant facts, exact paths or commands already known, constraints, and the expected deliverable.
- With context="parent", the subagent also receives the parent conversation. Use this when the task genuinely depends on substantial prior context; prefer task context for focused work.
- For lookups, provide exact paths or commands you already know. For investigations, provide the question rather than rigid steps that may rest on a false premise.
- Do not delegate understanding you already need in order to specify the task correctly.

Usage notes:
- Skip delegation for trivial work that takes only one or two direct tool calls.
- Run in the foreground when your next step needs the result. Set run_in_background=true only for independent work you can leave running while you continue; its completion arrives automatically.
- The result is visible to you, not directly to the user. Summarize the relevant result in your own response.
- Once a subagent owns a scope, do not duplicate the same searches or edits in parallel.
- Set model and provider together only when the child should use a different available model. Otherwise omit both.`;

export const KIMI_BASH_DESCRIPTION = `Execute a shell command. Use Bash for pipes, environment inspection, processes, git, package managers, build and test runners, and other work that genuinely needs shell semantics.

Use a dedicated tool instead when it fits:
- known file content: Read
- exact in-place replacement: Edit
- create or fully replace a file: Write
- locate files by name pattern: Glob
- search file contents: Grep

Each call starts in a fresh shell environment. Use absolute paths or put directory selection in the command; do not rely on state from an earlier Bash call. Foreground timeout is in milliseconds. With run_in_background=true, the command returns a task ID; use TaskOutput for a deliberate snapshot and TaskStop only when cancellation is necessary. Completion is reported automatically.

Independent read-only commands should be separate parallel Bash calls rather than one chained command. Chain commands only when their execution order or success is meaningfully dependent.

Commands run through Rig's shared permission boundary. Set dangerouslyDisableSandbox=true only to request review for one command that must run outside the workspace sandbox in Auto mode. A denial applies to that exact action and must not be routed around.`;

export const KIMI_READ_DESCRIPTION = `Read a file from the local filesystem.

If the user provides a concrete file path, call Read directly instead of pre-checking it with Glob or Bash. Use Glob to locate files by name and Grep to find unknown content. Read several independent files in parallel when possible.

- file_path must be absolute.
- By default Read returns up to 2,000 numbered lines. Use offset and limit to page through a larger file.
- Read returns text with line numbers for matching Edit.old_string; never include the line-number prefix in an edit.
- Images are returned as visual content. Jupyter notebooks are intentionally unsupported.
- Read only reads files. Use Bash to list a known directory.
- File access is enforced by Rig's permission and sensitive-path boundary.`;

export const KIMI_WRITE_DESCRIPTION = `Create or completely replace a file.

- Use Edit for every incremental change to an existing file, including small or cosmetic changes.
- Read before overwriting an existing file.
- Write is appropriate when the file does not exist or the entire contents must be replaced.
- Parent directories are created by Rig when needed.
- Never include Read's line-number prefixes in content.
- Do not create unsolicited README, summary, or other documentation files merely because a task finished.`;

export const KIMI_EDIT_DESCRIPTION = `Perform exact string replacements in an existing file.

- Read the target file before editing. Do not edit from memory, stale context, or a guessed old_string.
- Copy old_string and new_string from the file content, excluding Read's line-number prefix.
- old_string must be unique unless replace_all=true. Add surrounding context when it is ambiguous.
- Use replace_all only when every occurrence should change, such as a deliberate symbol rename.
- Prefer Edit over Write or shell text-replacement commands for incremental changes.
- Multiple Edit calls may run in parallel only when they target different files.`;

export const KIMI_GLOB_DESCRIPTION = `Find files by glob pattern.

Use Glob when you need paths matching a name pattern. It respects repository ignore files, returns files rather than directories, caps results, and is safer and more concise than recursive shell listing. A bare pattern such as *.ts matches recursively; use an anchored pattern such as src/**/*.ts to narrow large searches. Avoid dependency and build-output trees that would flood the result cap.`;

export const KIMI_GREP_DESCRIPTION = `Search file contents with ripgrep regular expressions.

Use Grep to find unknown content or locations. Use Read directly when the path is already known. Prefer this tool over shell grep or rg because Rig applies workspace policy and output limits. Narrow broad searches with path, glob, type, output_mode, and head_limit. Enable multiline only when the expression must cross line boundaries.`;

export const KIMI_TASK_OUTPUT_DESCRIPTION = `Retrieve a snapshot of a running or completed background shell task or workflow.

Prefer automatic completion notifications. Use block=false for a deliberate progress check. Use block=true only when the user explicitly asked you to wait; if it times out, continue with other work instead of repeatedly blocking. The task_id comes from Bash(run_in_background=true) or a workflow launch.`;

export const KIMI_TASK_STOP_DESCRIPTION = `Stop a running background shell task or workflow. Use this only when the work must genuinely be cancelled; stopping may leave partial side effects. For normal completion, rely on its notification or inspect it with TaskOutput.`;

export const KIMI_TODO_LIST_DESCRIPTION = `Maintain a structured TODO list for a multi-step task. Use it when progress tracking adds clarity across several tool calls, not for trivial one-shot work.

- Call with todos to replace the current Kimi TODO list. Use short, actionable titles and pending, in_progress, or done status.
- Omit todos to read the current list without changing it. Pass an empty array to clear it.
- Keep exactly one item in_progress while tracked work is underway.
- Mark an item done immediately after it is fully accomplished and verified. Do not mark partial, failing, blocked, or unverified work done.
- Avoid churn: update the list only after meaningful progress or a requirement change.`;

export const KIMI_FETCH_URL_DESCRIPTION = `Fetch and extract content from a fully formed public HTTP or HTTPS URL. Use this when you need to read a specific page. The fetch has no browser login or private session, so treat a sign-in page as an authentication boundary rather than the requested content. Use prompt only when the returned page should be filtered to a focused question.`;

export const KIMI_WEB_SEARCH_DESCRIPTION = `Search the public web for current information. Use this for facts that may have changed, external documentation, releases, errors, and upstream APIs. Prefer primary sources and use FetchURL to inspect a specific result in full. Do not search when the answer is already available in the workspace or conversation.`;

export const KIMI_ASK_USER_QUESTION_DESCRIPTION = `Ask the user one or more structured questions only when their answer materially changes the next action. Prefer proceeding from available evidence for trivial choices. Keep questions specific, options distinct, and labels short; the interface supplies a custom-answer option automatically.`;

export const KIMI_CREATE_GOAL_DESCRIPTION = `Create a durable goal only when the user explicitly asks Rig to pursue a long-running objective. Do not infer a goal from an ordinary task. The objective must have a checkable completion state, and a new goal cannot replace an unfinished goal.`;

export const KIMI_GET_GOAL_DESCRIPTION = `Get the durable goal for this session, including its objective and current status. Use this to recover goal state after context compaction or when the current objective is uncertain.`;

export const KIMI_UPDATE_GOAL_DESCRIPTION = `Mark the current durable goal complete or blocked. Use complete only when the full objective is achieved and verified with no required work remaining. Use blocked only when meaningful progress cannot continue without user input or an external state change.`;
