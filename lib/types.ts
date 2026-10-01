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
};

export type DashboardData = {
  agents: Agent[];
  source: "airtable" | "sample";
};
