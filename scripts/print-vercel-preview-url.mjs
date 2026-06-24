/**
 * Prints the latest Vercel Preview URL for preview/brayden-portal from GitHub
 * deployment status (the branch alias in package.json is not always provisioned).
 */
const REPO = "braydenwhite-blip/YPP-Portal";
const BRANCH = "preview/brayden-portal";

const refRes = await fetch(
  `https://api.github.com/repos/${REPO}/git/ref/heads/${encodeURIComponent(BRANCH)}`
);
if (!refRes.ok) {
  console.error(`Could not resolve branch ${BRANCH} (${refRes.status}).`);
  process.exit(1);
}
const ref = await refRes.json();
const sha = ref.object?.sha;
if (!sha) {
  console.error("No commit SHA on branch.");
  process.exit(1);
}

const depRes = await fetch(
  `https://api.github.com/repos/${REPO}/deployments?sha=${sha}&environment=Preview&per_page=1`
);
const deployments = depRes.ok ? await depRes.json() : [];
const deployment = deployments[0];
if (!deployment) {
  console.error("No Preview deployment found for latest branch commit.");
  process.exit(1);
}

const statusRes = await fetch(deployment.statuses_url);
const statuses = statusRes.ok ? await statusRes.json() : [];
const success = statuses.find((s) => s.state === "success" && s.environment_url);
const url = success?.environment_url ?? success?.target_url;

if (!url || !url.startsWith("http")) {
  console.error("Deployment exists but no public URL yet — check Vercel dashboard.");
  process.exit(1);
}

console.log(url.endsWith("/") ? url : `${url}/`);
