export type Student = {
  id: number;
  classId: number;
  name: string;
  rollNumber: string;
};

export type StudentListResponse = {
  students: Student[];
};

export type NewStudent = {
  rollNumber: string;
  name: string;
};

export type AddStudentsRequest = {
  students: NewStudent[];
};

export type StudentWithPin = {
  student: Student;
  pin: string;
};

export type AddStudentsResponse = {
  students: StudentWithPin[];
};

export type NewPinsResponse = {
  students: StudentWithPin[];
};

export type UpdateStudentRequest = {
  name?: string;
  rollNumber?: string;
  classId?: number;
};

export type StudentResponse = {
  student: Student;
};

export type MoveStudentsRequest = {
  toClassId: number;
};

export type MoveStudentsResponse = {
  movedStudentCount: number;
};

export type StudentLimits = {
  maxNameLength: 60;
  maxRollNumberLength: 30;
  maxStudentsPerRequest: 100;
  pinLength: 6;
};
