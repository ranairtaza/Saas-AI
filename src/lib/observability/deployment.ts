/**
 * Phase 48: Deployment & Runtime Metadata Inspector
 * Safely extracts operational build, git, and runtime information without exposing secrets.
 */

export interface DeploymentMetadata {
  environment: string;
  nodeEnv: string;
  gitSha: string;
  gitBranch: string;
  branch: string;
  buildVersion: string;
  nextVersion: string;
  nodeVersion: string;
  runtimeVersion: string;
  uptimeSeconds: number;
  deployedAt?: string;
  serverRegion?: string;
}

export function getDeploymentMetadata(): DeploymentMetadata {
  const env = process.env;

  const gitSha =
    env.VERCEL_GIT_COMMIT_SHA ||
    env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    env.GIT_COMMIT_SHA ||
    'ff3e493';

  const gitBranch =
    env.VERCEL_GIT_COMMIT_REF ||
    env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ||
    env.GIT_BRANCH ||
    'main';

  const nodeVersion = process.version;
  const nodeEnv = env.NODE_ENV || 'development';

  return {
    environment: nodeEnv,
    nodeEnv,
    gitSha: gitSha.substring(0, 7),
    gitBranch,
    branch: gitBranch,
    buildVersion: env.npm_package_version || '1.0.0',
    nextVersion: '16.3.3 (Turbopack)',
    nodeVersion,
    runtimeVersion: nodeVersion,
    uptimeSeconds: Math.floor(process.uptime()),
    deployedAt: env.VERCEL_DEPLOYMENT_DATE || undefined,
    serverRegion: env.VERCEL_REGION || 'local',
  };
}
