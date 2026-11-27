---
description: Find where my weekly Claude usage went, from local logs and GitHub
---
Context: the Fable model is about 40% of my weekly usage, and several people share this account. Read-only, change nothing.
1. Local: analyze ~/.claude/projects jsonl logs for the last 7 days: tokens per day and per model (Fable share in percent), and the 5 heaviest sessions.
2. GitHub: use gh to list all my repos (gh repo list --limit 100). For each, read commits and PRs from the last 7 days. Count commits carrying a Claude-Session line or Co-Authored-By: Claude, grouped by repo, author, and distinct session. Rank repos by sessions and size of changes.
3. If gh is not installed or not logged in, give me the exact simple steps for a Mac beginner.
Reply briefly in Arabic (Gulf dialect, plain bullets, no tables): repo ranking, any sign of different people, likely causes, 3 fixes.
End with one line: GitHub shows work done, not exact tokens, so this part is an estimate.
