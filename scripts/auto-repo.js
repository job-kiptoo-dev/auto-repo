#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load env vars
dotenv.config();

function run(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

// Example usage
const command = process.argv[2];

switch (command) {
  case "init":
    const repoName = process.argv[3] || "my-repo";
    console.log(`🚀 Initializing repo: ${repoName}`);

    // GitHub token from .env
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error("❌ Missing GITHUB_TOKEN in .env");
      process.exit(1);
    }

    // Example: create repo with gh cli
    run(`gh repo create ${repoName} --public --confirm`);

    break;

  case "push":
    console.log("📤 Pushing changes...");
    run("git add .");
    run(`git commit -m "auto commit"`);
    run("git push origin main");
    break;

  default:
    console.log(`
Usage:
  auto-repo init <repo-name>   # Create a new GitHub repo
  auto-repo push               # Commit & push changes
`);
}
