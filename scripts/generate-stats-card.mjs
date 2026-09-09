import { mkdir, writeFile } from "node:fs/promises";

const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error("GITHUB_TOKEN is required");

const query = `
  query($login: String!) {
    user(login: $login) {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes { stargazerCount }
      }
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "Zennmn-profile-card",
  },
  body: JSON.stringify({ query, variables: { login: "Zennmn" } }),
});

if (!response.ok) throw new Error(`GitHub API returned ${response.status}`);
const payload = await response.json();
if (payload.errors) throw new Error(payload.errors.map(({ message }) => message).join("; "));

const user = payload.data.user;
if (user.repositories.totalCount > 100) {
  throw new Error("Repository pagination is required before the star total is complete");
}

const days = user.contributionsCollection.contributionCalendar.weeks
  .flatMap(({ contributionDays }) => contributionDays)
  .sort((a, b) => a.date.localeCompare(b.date));

let longestStreak = 0;
let runningStreak = 0;
for (const day of days) {
  runningStreak = day.contributionCount > 0 ? runningStreak + 1 : 0;
  longestStreak = Math.max(longestStreak, runningStreak);
}

const contributions = user.contributionsCollection.contributionCalendar.totalContributions;
const stars = user.repositories.nodes.reduce((sum, repo) => sum + repo.stargazerCount, 0);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="195" viewBox="0 0 495 195" role="img" aria-label="${contributions} contributions, ${stars} stars, ${longestStreak} day longest streak">
  <title>Zennmn's GitHub activity</title>
  <rect width="495" height="195" rx="4.5" fill="#0d1117"/>
  <style>
    .number { font: 600 28px -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif; fill: #58a6ff; }
    .label { font: 400 13px -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif; fill: #c9d1d9; }
    .date { font: 400 11px -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif; fill: #8b949e; }
  </style>
  <g text-anchor="middle">
    <text class="number" x="88" y="84">${contributions}</text>
    <text class="label" x="88" y="110">Total Contributions</text>
    <text class="date" x="88" y="132">past year</text>

    <circle cx="247.5" cy="80" r="48" fill="none" stroke="#58a6ff" stroke-width="4"/>
    <text x="247.5" y="59" font-size="18" fill="#f2cc60">★</text>
    <text class="number" x="247.5" y="91">${stars}</text>
    <text class="label" x="247.5" y="113">Total Stars</text>
    <text class="date" x="247.5" y="154">across public repositories</text>

    <text class="number" x="407" y="84">${longestStreak}</text>
    <text class="label" x="407" y="110">Longest Streak</text>
    <text class="date" x="407" y="132">days</text>
  </g>
  <path d="M137 98H191M304 98H358" stroke="#30363d" stroke-width="1"/>
</svg>\n`;

await mkdir("assets", { recursive: true });
await writeFile("assets/stars-streak-card.svg", svg, "utf8");
console.log(`Generated card: ${contributions} contributions, ${stars} stars, ${longestStreak}-day streak`);
