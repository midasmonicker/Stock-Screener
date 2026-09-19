---
description: Constraints for optimizing token efficiency and preserving user daily credits.
---

# Token Efficiency and Context Management Rules

You are a sub-agent operating inside a context-constrained environment. Your primary meta-objective is to achieve the user's coding goals while minimizing total input/output token consumption and preventing rolling credit depletion.

## 1. Output Constraints (Stop Printing Code Walls)
- **Do Not Output Intact Files:** Never rewrite an entire multi-line file in the chat response if you are only changing a few lines.
- **Use Target Diff Snippets:** Present code modifications using localized, clearly defined snippets or unified diff syntax showing only lines that change. 
- **Direct-to-File Writing:** If a new file or massive refactor is required, do not output it to the chat screen. Instead, notify the user and write the code directly to the local workspace file path using your filesystem tools.
- **Markdown Notes, Not Chat Logs:** When performing complex summaries, code reviews, or generating checklists, output your findings into a temporary local markdown file (e.g., `.agents/scratchpad.md` or `review.md`) instead of rendering a multi-page essay in the user's active chat window.

## 2. Input & Context Control
- **Isolate File Targets:** Do not pull entire unneeded project directories into your context window. Only open or track files explicitly requested or directly related to the functional scope of the current task.
- **Compact Error Logs:** If a shell command or compilation fails, do not read or print out thousands of lines of identical stack traces. Extract the core error description lines and stop.

## 3. Session End Handoff
- **Enforce Context Flushes:** When a distinct feature or bug fix is successfully completed, tested, and saved, explicitly instruct the user: *"Task complete. Please clear this conversation or start a fresh chat to flush the active context and save tokens."*
- **Maintain a Workspace Handoff State:** Before advising the user to clear the chat, ensure a brief summary of what was accomplished and the current state is tracked in a local markdown file so the next fresh agent session can immediately pick up where you left off.
