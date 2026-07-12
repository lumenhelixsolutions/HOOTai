export const HOOT_ACTIONS = {
  SET_MODE_BASIC: "set-mode-basic",
  SET_MODE_ADVANCED: "set-mode-advanced",
  OPEN_BASIC_WORKFLOW: "open-basic-workflow",
  OPEN_ADVANCED_WORKFLOW: "open-advanced-workflow",
  PREFAB_LOCAL: "prefab-local",
  PREFAB_CLOUD: "prefab-cloud",
  PREFAB_HYBRID: "prefab-hybrid",
  PREFAB_REVIEW: "prefab-review",
  GENERATE_HANDOFF: "generate-handoff",
  OPEN_ONBOARDING: "open-onboarding",
} as const;

export type HootActionTarget = (typeof HOOT_ACTIONS)[keyof typeof HOOT_ACTIONS];

export function isHootActionTarget(target: string): target is HootActionTarget {
  return Object.values(HOOT_ACTIONS).includes(target as HootActionTarget);
}
