export type AnswerPhoto = {
  photoNumber: number;
  clientPhotoId: string;
  width: number;
  height: number;
};

export type AnswerPhotoListResponse = {
  photos: AnswerPhoto[];
  photosOpenUntil: number | null;
  serverTime: number;
};

export type SaveAnswerPhotoResponse = {
  photo: AnswerPhoto;
};

export type AnswerPhotoLimits = {
  maxPhotos: 10;
  maxPhotoBytes: 3_000_000;
  photoWindowMinutes: 30;
};
