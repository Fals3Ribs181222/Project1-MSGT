---
name: pushing-code
description: Automates the process of staging, committing, and pushing code to a remote repository. Use when the user asks to push changes, sync with Git, or upload code to a repository.
---

# Pushing Code

## When to use this skill
- User says "push my code", "upload to github", "sync changes", or "commit and push".
- User mentions deploying or sharing their work via a git repository.

## Workflow

1.  **Status Check**: Run `git status` to see what changes are pending.
2.  **Verify Remote**: Ensure a remote (e.g., `origin`) is configured using `git remote -v`.
3.  **Branch Check**: Confirm the current branch with `git branch --show-current`.
4.  **Stage Changes**: Add relevant files using `git add .` or specific paths.
5.  **Commit**: Create a commit with a clear, concise message using `git commit -m "[message]"`.
6.  **Push**: Push to the remote repository using `git push [remote] [branch]`.

## Instructions

### 1. Preparation
Always verify the state of the repository before pushing. Avoid pushing sensitive files (check `.gitignore`).

### 2. Handling Remotes
If no remote is set, ask the user for the repository URL and add it:
```powershell
git remote add origin <url>
```

### 3. Commit Messages
Commit messages should follow a standard format if not specified by the user:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests

### 4. Common Commands

#### Stage all files
```powershell
git add -A
```

#### Commit with message
```powershell
git commit -m "feat: implement pushing-code skill"
```

#### Push to main branch
```powershell
git push origin main
```

#### Push to current branch
```powershell
git push origin $(git branch --show-current)
```

## Error Handling
- **Authentication Issues**: If push fails due to authentication, advise the user to check their Git credentials or SSH keys.
- **Conflicts**: If the push is rejected because the remote contains work that you do not have locally, run `git pull --rebase` first, resolve conflicts, and then try pushing again.
- **No Upstream**: If the branch has no upstream branch, use:
  ```powershell
  git push --set-upstream origin $(git branch --show-current)
  ```
