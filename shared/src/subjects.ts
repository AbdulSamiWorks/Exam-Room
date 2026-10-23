export type Subject = {
  id: number;
  classId: number;
  name: string;
};

export type CreateSubjectRequest = {
  name: string;
};

export type UpdateSubjectRequest = {
  name?: string;
  classId?: number;
};

export type SubjectResponse = {
  subject: Subject;
};

export type MoveSubjectTestsRequest = {
  toSubjectId: number;
};

export type MoveSubjectTestsResponse = {
  movedTestCount: number;
};

export type SubjectLimits = {
  maxNameLength: 50;
};
