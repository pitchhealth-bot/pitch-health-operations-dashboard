export type AirtableAttachment = {
  id?: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
};

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
  contractingDesignation?: string;
  startDate?: string;
  personalEmail?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  npn?: string;
  ssn?: string;
  discordUserId?: string;
  residentState?: string;
  states?: string;
  ahip2027?: AirtableAttachment[];
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


export type WorkforceMovementRecord = {
  id: string;
  name: string;
  role?: string;
  status?: string;
  startDate?: string;
  terminationDate?: string;
};

export type WorkforceMovementData = {
  records: WorkforceMovementRecord[];
  source: "airtable" | "sample" | "error";
  error?: string;
};


export type JourneyDirectoryRecord = {
  id: string;
  name: string;
  email?: string;
  personalEmail?: string;
  npn?: string;
  status?: string;
  role?: string;
  licensingStatus?: string;
  bootcampUpdate?: string;
};

export type JourneyDirectoryData = {
  records: JourneyDirectoryRecord[];
  source: "airtable" | "sample" | "error";
  error?: string;
};
