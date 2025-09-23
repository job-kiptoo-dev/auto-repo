#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import readline from "readline";
import dotenv from "dotenv";
import { program } from "commander";

// Load environment variables from multiple possible locations
const envPaths = [
  path.join(process.cwd(), ".env"),
  path.join(process.env.HOME, "dotfiles/.env"),
  path.join(process.env.HOME, ".env"),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log(`📄 Loaded environment from: ${envPath}`);
    break;
  }
}

// CLI setup
program
  .name("auto-repo")
  .description("Automatically create and setup GitHub repositories")
  .version("1.1.0")
  .argument("[description]", "Repository description")
  .option("--token <token>", "GitHub personal access token")
  .option("--user <username>", "GitHub username")
  .option("--private", "Create private repository (default: public)")
  .option("--no-push", "Skip pushing to GitHub")
  .option("--help-token", "Show GitHub token setup instructions")
  .parse();

const options = program.opts();
const [descriptionArg] = program.args;

// Show token help if requested
if (options.helpToken) {
  showTokenHelp();
  process.exit(0);
}

// Helper functions
function showTokenHelp() {
  console.log(`
🔑 GitHub Token Setup Instructions:

1. Go to GitHub Settings:
   👉 https://github.com/settings/tokens

2. Click "Generate new token (classic)"

3. Select scopes:
   ✅ repo (Full control of private repositories)
   ✅ workflow (if you need workflow access)

4. Set up the token (choose one method):

   Method 1 - Environment Variable (Recommended):
   export GITHUB_TOKEN=your_token_here

   Method 2 - Add to shell profile:
   echo 'export GITHUB_TOKEN=your_token_here' >> ~/.bashrc
   source ~/.bashrc

   Method 3 - Create .env file:
   echo 'GITHUB_TOKEN=your_token_here' > ~/.env

   Method 4 - Pass as CLI argument:
   auto-repo --token=your_token_here "My project"

5. Verify setup:
   echo $GITHUB_TOKEN (should show your token)

🔐 Security Tips:
- Keep your token secret and secure
- Don't commit tokens to git repositories
- Use environment variables instead of hardcoding
  `);
}

function run(cmd, options = {}) {
  try {
    const result = execSync(cmd, {
      stdio: options.silent ? "pipe" : "inherit",
      encoding: "utf8",
    });
    return result;
  } catch (err) {
    if (!options.silent) {
      console.error(`❌ Failed: ${cmd}`);
      if (err.message) console.error(`   Error: ${err.message}`);
    }
    if (!options.continueOnError) {
      process.exit(1);
    }
    return null;
  }
}

function ask(question, options = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Hide input for sensitive data like tokens
  if (options.hidden) {
    rl.stdoutMuted = true;
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (rl.stdoutMuted) {
        rl.output.write("*");
      } else {
        rl.output.write(stringToWrite);
      }
    };
  }

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      if (options.hidden) {
        rl.output.write("\n");
      }
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function getGithubToken() {
  // Priority: CLI arg > env var > interactive prompt
  if (options.token) {
    console.log("🔑 Using token from CLI argument");
    return options.token;
  }

  if (process.env.GITHUB_TOKEN) {
    console.log("🔑 Using token from environment variable");
    return process.env.GITHUB_TOKEN;
  }

  console.log("🔑 No token found in environment or CLI args");
  const shouldShowHelp = await ask("Show token setup instructions? (y/n): ");
  if (shouldShowHelp.toLowerCase() === "y") {
    showTokenHelp();
  }

  const token = await ask("Enter your GitHub token: ", { hidden: true });
  if (!token) {
    console.error("❌ GitHub token is required to create repositories");
    console.log("Run 'auto-repo --help-token' for setup instructions");
    process.exit(1);
  }

  return token;
}

async function getGithubUsername(token) {
  if (options.user) {
    console.log(`👤 Using username from CLI: ${options.user}`);
    return options.user;
  }

  if (process.env.GITHUB_USER) {
    console.log(
      `👤 Using username from environment: ${process.env.GITHUB_USER}`,
    );
    return process.env.GITHUB_USER;
  }

  // Try to get username from GitHub API
  try {
    console.log("👤 Fetching username from GitHub API...");
    const userInfo = execSync(
      `curl -s -H "Authorization: token ${token}" https://api.github.com/user`,
      { encoding: "utf8" },
    );
    const user = JSON.parse(userInfo);
    if (user.login) {
      console.log(`👤 Found username: ${user.login}`);
      return user.login;
    }
  } catch (err) {
    console.log("⚠️ Could not fetch username from API");
  }

  // Fallback to interactive prompt
  const username = await ask("Enter your GitHub username: ");
  if (!username) {
    console.error("❌ GitHub username is required");
    process.exit(1);
  }

  return username;
}

async function validateToken(token) {
  try {
    console.log("🔍 Validating GitHub token...");
    const response = execSync(
      `curl -s -w "%{http_code}" -H "Authorization: token ${token}" https://api.github.com/user`,
      { encoding: "utf8" },
    );

    if (response.includes("200")) {
      console.log("✅ Token validation successful");
      return true;
    } else {
      console.error("❌ Token validation failed - check your token");
      return false;
    }
  } catch (err) {
    console.error("❌ Error validating token:", err.message);
    return false;
  }
}

async function createGithubRepo(
  token,
  username,
  repoName,
  description,
  isPrivate,
) {
  try {
    console.log(
      `📦 Creating ${isPrivate ? "private" : "public"} repo '${repoName}' for user '${username}'...`,
    );

    const repoData = {
      name: repoName,
      description: description,
      private: isPrivate,
    };

    const response = execSync(
      `curl -s -o /dev/null -w "%{http_code}" \
       -H "Authorization: token ${token}" \
       -H "Accept: application/vnd.github+json" \
       -H "Content-Type: application/json" \
       https://api.github.com/user/repos \
       -d '${JSON.stringify(repoData)}'`,
      { encoding: "utf8" },
    ).trim();

    if (response === "201") {
      console.log("✅ GitHub repository created successfully");
      return true;
    } else if (response === "422") {
      console.log("⚠️ Repository already exists on GitHub. Continuing...");
      return true;
    } else if (response === "401") {
      console.error("❌ Authentication failed - check your token");
      return false;
    } else if (response === "403") {
      console.error("❌ Forbidden - check token permissions or rate limits");
      return false;
    } else {
      console.error(`❌ Failed to create repository (HTTP ${response})`);
      return false;
    }
  } catch (err) {
    console.error("❌ Error calling GitHub API:", err.message);
    return false;
  }
}

function setupGitRepo() {
  console.log("🔧 Setting up local git repository...");

  if (!fs.existsSync(".git")) {
    console.log("   Initializing git repository...");
    run("git init");
  } else {
    console.log("   Git repository already exists");
  }

  // Check if there are any changes to commit
  const status = run("git status --porcelain", { silent: true });
  if (status && status.trim()) {
    console.log("   Adding and committing changes...");
    run("git add .");

    // Check if there are any commits yet
    const hasCommits = run("git log --oneline -1", {
      silent: true,
      continueOnError: true,
    });
    if (!hasCommits) {
      run('git commit -m "Initial commit"');
    } else {
      const commitMsg = `Update repository - ${new Date().toISOString().split("T")[0]}`;
      run(`git commit -m "${commitMsg}"`);
    }
  } else {
    console.log("   No changes to commit");
  }

  // Ensure we're on main branch
  run("git branch -M main");
}

function setupRemoteOrigin(username, repoName) {
  console.log("🔗 Setting up remote origin...");

  const remoteUrl = `git@github.com:${username}/${repoName}.git`;

  try {
    // Try to add remote
    run(`git remote add origin ${remoteUrl}`, { silent: true });
    console.log("   Remote origin added");
  } catch {
    try {
      // If it fails, try to set the URL (remote might already exist)
      run(`git remote set-url origin ${remoteUrl}`, { silent: true });
      console.log("   Remote origin updated");
    } catch {
      console.error("❌ Failed to setup remote origin");
      process.exit(1);
    }
  }
}

function setupSSH() {
  console.log("🔐 Setting up SSH configuration...");

  // Ensure .ssh directory exists
  const sshDir = path.join(process.env.HOME, ".ssh");
  if (!fs.existsSync(sshDir)) {
    fs.mkdirSync(sshDir, { mode: 0o700 });
  }

  // Add GitHub to known hosts if not already there
  const knownHostsFile = path.join(sshDir, "known_hosts");
  let knownHosts = "";

  if (fs.existsSync(knownHostsFile)) {
    knownHosts = fs.readFileSync(knownHostsFile, "utf8");
  }

  if (!knownHosts.includes("github.com")) {
    console.log("   Adding GitHub to known hosts...");
    run("ssh-keyscan -H github.com >> ~/.ssh/known_hosts");
  } else {
    console.log("   GitHub already in known hosts");
  }
}

async function pushToGithub() {
  console.log("🚀 Pushing to GitHub...");

  try {
    // Test SSH connection first
    console.log("   Testing SSH connection...");
    const sshTest = run("ssh -T git@github.com", {
      silent: true,
      continueOnError: true,
    });

    // Push to GitHub
    run("git push -u origin main");
    console.log("✅ Successfully pushed to GitHub");
    return true;
  } catch (err) {
    console.error("❌ Push failed. This might be due to:");
    console.error("   • SSH key not set up with GitHub");
    console.error("   • Network connectivity issues");
    console.error("   • Repository permissions");

    const shouldContinue = await ask("Continue anyway? (y/n): ");
    return shouldContinue.toLowerCase() === "y";
  }
}

// Main execution
(async () => {
  try {
    console.log("🚀 Auto-Repo: Automated GitHub Repository Creator\n");

    // Get repository name (current directory name)
    const REPO_NAME = path.basename(process.cwd());
    console.log(`📁 Repository name: ${REPO_NAME}`);

    // Get description
    let DESCRIPTION = descriptionArg;
    if (!DESCRIPTION) {
      DESCRIPTION = await ask(
        `📝 Enter a description for '${REPO_NAME}' (or press Enter for default): `,
      );
      if (!DESCRIPTION) {
        DESCRIPTION = `Auto-created repository: ${REPO_NAME}`;
      }
    }
    console.log(`📝 Description: ${DESCRIPTION}`);

    // Get GitHub token
    const TOKEN = await getGithubToken();

    // Validate token
    const isValidToken = await validateToken(TOKEN);
    if (!isValidToken) {
      console.error(
        "❌ Invalid token. Please check your GitHub token and try again.",
      );
      console.log("Run 'auto-repo --help-token' for setup instructions");
      process.exit(1);
    }

    // Get GitHub username
    const GITHUB_USER = await getGithubUsername(TOKEN);

    // Create GitHub repository
    const repoCreated = await createGithubRepo(
      TOKEN,
      GITHUB_USER,
      REPO_NAME,
      DESCRIPTION,
      options.private || false,
    );

    if (!repoCreated) {
      console.error("❌ Failed to create GitHub repository");
      process.exit(1);
    }

    // Setup local git repository
    setupGitRepo();

    // Setup remote origin
    setupRemoteOrigin(GITHUB_USER, REPO_NAME);

    // Setup SSH
    setupSSH();

    // Push to GitHub (unless --no-push flag is used)
    if (options.push !== false) {
      const pushSuccess = await pushToGithub();
      if (!pushSuccess) {
        console.log("⚠️ Repository created but push failed");
      }
    } else {
      console.log("⏭️ Skipping push (--no-push flag used)");
    }

    // Success message
    console.log("\n" + "=".repeat(50));
    console.log("🎉 Repository setup completed!");
    console.log(`📍 Local: ${process.cwd()}`);
    console.log(`🌐 GitHub: https://github.com/${GITHUB_USER}/${REPO_NAME}`);
    console.log("=".repeat(50));
  } catch (error) {
    console.error("\n❌ An unexpected error occurred:", error.message);
    console.error("\n🐛 If this error persists, please report it at:");
    console.error("   https://github.com/job-kiptoo-dev/auto-repo/issues");
    process.exit(1);
  }
})();
