export type Subject = {
  id: number;
  name: string;
};

export type SubjectListResponse = {
  subjects: Subject[];
};

export type CreateSubjectRequest = {
  name: string;
};

export type CreateSubjectResponse = {
  subject: Subject;
};

export type SubjectLimits = {
  maxNameLength: 50;
};
