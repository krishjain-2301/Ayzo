export type Verdict = "pass" | "fail" | "error" | "inconclusive";
export type ScanStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface Target {
  id: string;
  name: string;
  description: string | null;
  project_path: string;
  start_command: string;
  target_port: number;
  chat_path: string | null;
  canaries: string[] | null;
  system_prompt: string | null;
  expected_behavior: string | null;
  rules: string[] | null;
  forbidden_tools: string[] | null;
  request_headers: Record<string, string> | null;
  request_field: string | null;
  response_field: string | null;
  extra_body: Record<string, unknown> | null;
  history_mode: "client" | "server" | null;
  status: string;
  created_at: string;
}

export interface ScanSummary {
  id: string;
  name: string;
  target_name: string;
  status: ScanStatus;
  total_tests: number;
  failed_tests: number;
  error_tests: number;
  inconclusive_tests: number;
  status_detail: string | null;
  risk_score: number | null;
  progress_percent: number;
  created_at: string;
}

export interface Scan {
  id: string;
  name: string;
  description: string | null;
  target_id: string;
  status: ScanStatus;
  attack_categories: string[];
  mutation_depth: number;
  trials: number | null;
  run_config: Record<string, unknown> | null;
  total_tests: number;
  completed_tests: number;
  passed_tests: number;
  failed_tests: number;
  error_tests: number | null;
  inconclusive_tests: number | null;
  progress_percent: number;
  risk_score: number | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface Evidence {
  attack_name?: string | null;
  severity?: string | null;
  method?: string | null;
  prompt?: string;
  response?: string;
  reasoning?: string;
  generation?: number;
}

export interface Taxonomy {
  owasp: { id: string; name: string };
  atlas: { id: string; name: string } | null;
}

export interface Finding {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: string;
  confidence: number;
  occurrence_count: number;
  total_tests_in_category: number;
  failure_rate: number;
  remediation: string | null;
  evidence: Evidence[];
  taxonomy?: Taxonomy | null;
}

export interface CategoryScore {
  category: string;
  display_name: string;
  total_tests: number;
  failures: number;
  failure_rate: number;
  severity: string;
}

export interface Report {
  campaign_id: string;
  campaign_name: string;
  target_name: string;
  target_model: string;
  status: ScanStatus;
  status_detail: string | null;
  overall_risk_score: number | null;
  risk_level: string;
  total_tests: number;
  total_failures: number;
  total_passes: number;
  total_errors: number;
  total_inconclusive: number;
  coverage: number;
  attack_success_rate: number | null;
  asr_low: number | null;
  asr_high: number | null;
  trials: number;
  category_scores: CategoryScore[];
  findings: Finding[];
  campaign_started_at: string | null;
  campaign_completed_at: string | null;
}

export interface ResultRow {
  attack_name: string | null;
  attack_category: string | null;
  result: Verdict;
  severity: string | null;
  confidence: number | null;
  method: string | null;
  prompt_sent: string;
  model_response: string | null;
  eval_reasoning: string | null;
  mutation_generation: number;
  trials?: number;
  worked_trials?: number | null;
  tool_calls?: string[];
  taxonomy?: Taxonomy | null;
}

export interface ChangedAttack {
  category: string;
  attack_name: string | null;
  severity: string | null;
  method: string | null;
  stable_name: boolean;
}

export interface Comparison {
  baseline_id: string | null;
  baseline_name?: string;
  baseline_risk_score?: number | null;
  new_failures?: ChangedAttack[];
  new_stable_failures?: ChangedAttack[];
  fixed?: ChangedAttack[];
  still_failing?: ChangedAttack[];
}

export interface Category {
  id: string;
  name: string;
  owasp_id: string;
  description: string;
  attack_count: number;
}

export interface Payload {
  category: string;
  subcategory: string;
  name: string;
  description: string;
  original_prompt: string;
  success_indicators: string;
  severity: string;
  is_builtin: boolean;
  marker: string | null;
}

export interface Provider {
  id: string;
  name: string;
  prefix: string;
  models: string[];
  key_set: boolean;
  key_url: string;
}

export interface ModelsOverview {
  eval_model: string;
  mutator_model: string;
  effective_mutator_model: string;
  eval_model_missing_key: string | null;
  local: {
    ollama: { running: boolean; models: string[] };
    claude_cli: { installed: boolean; models: string[] };
  };
  providers: Provider[];
}

export interface Suggestions {
  files_scanned: number;
  chat_paths: string[];
  ports: number[];
  request_fields: string[];
  system_prompts: { file: string; text: string }[];
  canaries: string[];
  tools: string[];
}

export interface AgenticResult {
  status: "completed" | "error";
  message?: string;
  goal?: string;
  turns_taken?: number;
  result?: "pass" | "fail" | "inconclusive";
  eval_reasoning?: string;
  transcript?: { turn: number; speaker: "Attacker" | "Target"; message: string }[];
  time_taken_ms?: number;
}
