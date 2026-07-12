/** View-scoped pageContext for coach chat — avoids shipping the whole screen every turn. */

const VIEW_KEYS: Record<string, string[]> = {
  "/": ["readyCount", "blockedCount", "scanPresent", "runningCount", "portfolioIssues", "productionSessionActive", "productionEstContextTokens", "productionAgentName", "productionModelId", "grokSessionActive", "grokEstContextTokens"],
  "/dashboard": ["readyCount", "blockedCount", "scanPresent", "runningCount", "portfolioIssues", "productionSessionActive", "productionEstContextTokens"],
  "/scan": ["scanLoaded", "ollamaPresent", "missingAgents", "tokenBurnRisk", "agentRadarExternal", "agentRadarTotal", "productionSessionActive", "productionEstContextTokens", "productionAgentName", "productionModelId", "grokSessionActive", "grokEstContextTokens"],
  "/profiles": ["viewMode", "easyStep", "easyTopPickId", "easyTopPickName", "blockedCount", "readyCount"],
  "/builder": ["stackScore", "stackIssues", "wizardStep", "hasAgent", "hasLlm", "nodeCount"],
  "/stack": ["stackScore", "stackIssues", "wizardStep", "hasAgent", "hasLlm", "nodeCount"],
  "/launch": ["recommendedCount", "previewProfileId", "stagedProfileId", "hasAuditWarnings", "runningCount"],
  "/modules": ["modulesTab", "modulesOutdated", "modulesNeedSync", "modulesReady", "cePluginDetected"],
  "/terminal": ["runningCount", "activeSessionId", "errorCount"],
  "/settings": ["vaultKeyCount", "llamacppEnabled"],
  "/deck": ["providerMatrix"],
  "/activity": ["activityDays"],
  "/bench": ["benchModelCount", "benchPassCount", "benchUpdatedAt"],
  "/approvals": ["approvalCount", "phase4Ready", "approvalRecentOk"],
  "/portfolio": ["portfolioMvpCount", "portfolioBrainCount", "portfolioGitIssues", "activeProjectName"],
  "/pipeline": ["milestoneCount", "activeProjectName"],
};

const SHARED_KEYS = ["providerMatrix", "tokenBurnRisk", "tokenBurnSaved"];

export function slimCoachPageContext(
  view: string,
  pageContext: Record<string, unknown> = {},
): Record<string, unknown> {
  const keys = new Set([...(VIEW_KEYS[view] || []), ...SHARED_KEYS]);
  const slim: Record<string, unknown> = { _slim: true, view };
  for (const key of keys) {
    if (pageContext[key] !== undefined) slim[key] = pageContext[key];
  }
  return slim;
}