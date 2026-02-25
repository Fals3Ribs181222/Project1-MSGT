# push.ps1 - Helper script for pushing code

param (
    [string]$Message = "chore: update code",
    [string]$Remote = "origin"
)

# 1. Get current branch
$Branch = git branch --show-current
if (-not $Branch) {
    Write-Error "Not a git repository or no branch found."
    exit 1
}

# 2. Add all changes
Write-Host "Staging changes..."
git add -A

# 3. Commit
Write-Host "Committing with message: $Message"
git commit -m $Message

# 4. Push
Write-Host "Pushing to $Remote $Branch..."
git push $Remote $Branch

if ($LASTEXITCODE -ne 0) {
    Write-Error "Push failed. Check for conflicts or authentication issues."
    exit 1
}

Write-Host "Successfully pushed code!"
