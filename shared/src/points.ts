export type PointsEntry = {
  id: number;
  points: number;
  reason: string;
  testTitle: string | null;
  createdAt: number;
};

export type StudentPoints = {
  studentId: number;
  name: string;
  rollNumber: string;
  points: number;
};

export type ClassPointsResponse = {
  students: StudentPoints[];
};

export type StudentPointsHistoryResponse = {
  entries: PointsEntry[];
  total: number;
};

export type AddPointsRequest = {
  points: number;
  reason: string;
};

export type OfflineMark = {
  studentId: number;
  marks: number | null;
};

export type OfflineMarksRequest = {
  marks: OfflineMark[];
};

export type OfflineMarkRow = {
  studentId: number;
  name: string;
  rollNumber: string;
  marks: number | null;
};

export type OfflineMarksResponse = {
  maxMarks: number;
  students: OfflineMarkRow[];
};
