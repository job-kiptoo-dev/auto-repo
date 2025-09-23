#!/usr/bin/env node

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.env.HOME, "dotfiles/.env") });

const GITHUB_USER = "job-kiptoo-dev"; // change if needed
const REPO_NAME = path.basename(process.cwd());
const TOKEN = process.env.GITHUB_TOKEN;

if (!TOKEN) {
  console.error("❌ GITHUB_TOKEN not set in .env");
  process.exit(1);
}

function run(cmd) {
  try {
    execSync(cmd, { stdio: "inherit" });
  } catch (err) {
    console.error(`❌ Failed: ${cmd}`);
    process.exit(1);
  }
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans);
    }),
  );
}

(async () => {
  // === Description ===
  let DESCRIPTION = process.argv.slice(2).join(" ");
  if (!DESCRIPTION) {
    DESCRIPTION = await ask(`📝 Enter a description for '${REPO_NAME}': `);
    if (!DESCRIPTION) DESCRIPTION = "Auto-created repo";
  }

  console.log(`📦 Creating repo '${REPO_NAME}' for user '${GITHUB_USER}'...`);

  // === Step 1: Create repo via API ===
  try {
    const response = execSync(
      `curl -s -o /dev/null -w "%{http_code}" \
       -H "Authorization: token ${TOKEN}" \
       -H "Accept: application/vnd.github+json" \
       https://api.github.com/user/repos \
       -d '{"name":"${REPO_NAME}","description":"${DESCRIPTION}","private":false}'`,
    )
      .toString()
      .trim();

    if (response === "201") {
      console.log("✅ GitHub repo created successfully.");
    } else if (response === "422") {
      console.log("⚠️ Repo already exists on GitHub. Continuing...");
    } else {
      console.error(`❌ Failed to create repo (HTTP ${response})`);
      process.exit(1);
    }
  } catch {
    console.error("❌ Error calling GitHub API");
    process.exit(1);
  }

  // === Step 2: Git init ===
  if (!fs.existsSync(".git")) {
    console.log("🔧 Initializing git repo locally...");
    run("git init");
  }

  // === Step 3: Commit ===
  try {
    run("git add .");
    run('git commit -m "Initial commit"');
  } catch {
    console.log("⚠️ Nothing to commit, skipping...");
  }

  // === Step 4: Remote origin ===
  run("git branch -M main");
  try {
    run(`git remote add origin git@github.com:${GITHUB_USER}/${REPO_NAME}.git`);
  } catch {
    run(
      `git remote set-url origin git@github.com:${GITHUB_USER}/${REPO_NAME}.git`,
    );
  }

  // === Step 5: SSH key scan ===
  run("ssh-keyscan -H github.com >> ~/.ssh/known_hosts");

  // === Step 6: Push ===
  console.log("🚀 Pushing to GitHub...");
  try {
    run("git push -u origin main");
  } catch {
    console.error("❌ Push failed. Check your SSH key setup.");
    process.exit(1);
  }

  console.log(
    `✅ Done! Repo available at: https://github.com/${GITHUB_USER}/${REPO_NAME}`,
  );
})();
