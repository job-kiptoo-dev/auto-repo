# auto-repo

⚡ Automate GitHub repo setup & commits.

# Auto Repo Script

This project includes a shell script (`auto-repo.sh`) that automates the process of creating a GitHub repository and pushing local files to it.

## Features
- 📦 Automatically creates a new repository on GitHub.
- 🔑 Uses a GitHub token from your `.env` file for authentication.
- 🌍 Creates repositories as **public** by default.
- 📝 Initializes the repo with a `README.md` file.
- 🚀 Automatically commits and pushes files to GitHub.
- ✅ Handles cases where the repo already exists.
- ⚠️ Provides helpful error messages (e.g., when remote already has commits).

## Requirements
- [Git](https://git-scm.com/) installed locally.
- [cURL](https://curl.se/) installed.
- A valid GitHub token with `repo` permissions stored in your `.env` file:

```bash
export GITHUB_TOKEN="your_personal_access_token"

## Install
```bash
npm install -g @captain-job/auto-repo

