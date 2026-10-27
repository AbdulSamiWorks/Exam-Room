import fbiseComputerSciencePaper from './sample-papers/fbise-computer-science-chapter-1.txt?raw';
import englishTensesPaper from './sample-papers/english-tenses-50-marks.txt?raw';

export type SamplePaper = {
  name: string;
  text: string;
};

export const SAMPLE_PAPERS: readonly SamplePaper[] = [
  { name: 'Computer Science, Federal Board pattern', text: fbiseComputerSciencePaper },
  { name: 'English tenses, typed answers checked by the app', text: englishTensesPaper },
];

export const SAMPLE_PAPER_TEXT = fbiseComputerSciencePaper;
