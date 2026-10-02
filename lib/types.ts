export type PipelineStage =
  | "Pre-Licensing"
  | "Exam"
  | "Pre-Contracting"
  | "Contracting"
  | "RTS";

export type Agent = {
  id: string;
  name: string;
  email?: string;
  status?: string;
  role?: string;
  currentStage?: string;
  stage: PipelineStage;
  subStage?: string;
  stageEnteredDate?: string;
  daysInStage: number;
  owner?: string;
  blocker?: string;
  blockerType?: string;
  missingFields: string[];
  licenseExpiry?: string;
  hierarchyVerified?: boolean;
  carrierSummary?: string;
  ceDueDate?: string;
  licensingStatus?: "Licensed" | "Non-licensed" | string;
};

export type DashboardData = {
  agents: Agent[];
  source: "airtable" | "sample" | "error";
  error?: string;
};
