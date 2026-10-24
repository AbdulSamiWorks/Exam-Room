# Paper format

A test can have a **typed paper** instead of a PDF. You paste the questions into **New test →
Paper → Type or paste**, the app shows a preview and any problems, and students see a clean paper
with big buttons for the multiple choice answers. You can write the paper as **plain text** (the
easiest way) or as **JSON** (good when another program or AI tool makes the paper for you).

Students never see the correct answers during the test. If the test allows it, each student sees
the multiple choice result right after finishing; everything else waits until you release the
results. You can change the answers at any time, also after the test, on **Questions and
answers**.

## Plain text

Copy this sample, change it, and paste it into the app.

```text
Answer all questions. Write clearly.

# Section A: Multiple choice
Choose the best answer. Each question has 1 mark.

1. What is the SI unit of force? [1 mark]
a) Joule
b) Newton
c) Watt
d) Pascal
Answer: b

2. Which of these is a vector quantity? [1 mark]
a) Mass
b) Speed
c) Velocity
d) Time
Answer: c

3. پاکستان کا دارالحکومت کون سا ہے؟ [1 mark]
a) لاہور
b) کراچی
c) اسلام آباد
Answer: c

# Section B: Short answers
Write the answers on the phone or on your paper, as your teacher says.

4. State Newton's first law of motion. [3 marks]
Answer: An object stays at rest, or keeps moving in a straight line at the same speed,
unless a force acts on it.

5. A car of mass 1000 kg speeds up at 2 m/s². Answer both parts.
a) Write the formula for force. [1]
b) Find the force on the car. [2]
```

The rules:

| You write                           | It means                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Lines before the first question     | Instructions for the whole paper                                                                      |
| `# Section A: ...`                  | A new section; the lines under it are its instructions                                                |
| `1. Question text [2 marks]`        | A new question (`Q1.` and `1)` work too). Marks: `[2]`, `[2 marks]`, `(2 marks)`, halves like `[1.5]` |
| No marks                            | The question counts 1 mark (the preview tells you)                                                    |
| `a) ...`, `b) ...` (or `A.`, `(a)`) | Options; they make it a multiple choice question (2 to 6 options)                                     |
| `Answer: b`                         | The correct option of a multiple choice question                                                      |
| `Answer: ...` under a written one   | The model answer; following lines belong to it. Students see it only after you release the results    |
| `a) ... [2]` lines with marks       | Parts of one written question; their marks are added up                                               |
| A line that is none of these        | Continues the question, option or answer above it                                                     |

More rules, so a Federal Board (FBISE) paper can be pasted exactly as it is written:

| You write                                                                                                   | It means                                                                                    |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Section A: Multiple choice (25 marks)`                                                                     | A new section, also without `#` (`Part 1: ...` works too); the marks stay in the title      |
| `a) analog  b) digital  c) sine wave  d) square`                                                            | All options on one line                                                                     |
| `a) ...` lines without marks, then a written answer, or in a section called Short / Long / Detailed answers | Parts of a written question (for example "write the dual of each expression")               |
| `Name: ______  Roll No.: ______` before questions                                                           | Left out; the app already knows the student                                                 |
| `\| A \| B \| F \|` lines                                                                                   | A table. Put `\|---\|---\|---\|` under the first row to make it the header row              |
| `x^{2}`, `H_{2}O`                                                                                           | Superscript and subscript: x², H₂O                                                          |
| `1.`, `2.` lines inside a model answer                                                                      | Stay in the answer; only the next question number (for example `27.`) starts a new question |

### Federal Board (FBISE) pattern

**New test → Paper → Type or paste → Start from a sample paper** loads a full HSSC-I paper
(Computer Science, Chapter 1: 25 multiple choice questions, 5 short and 2 detailed questions, 50
marks, with the truth table and K-map as tables). Change it for any subject, or paste your own
paper in the same pattern. Good settings for this pattern:

- **Written answers: Photos of the paper after finishing.** Students tap the multiple choice
  answers on the phone, write Sections B and C on paper and send up to 10 photos (pages) after
  finishing. Or choose typed answers, or both.
- **Students see their multiple choice result: Right after finishing.** Each student sees the
  MCQ marks and the correct answers as soon as they finish, and later in their portal. You mark
  the written answers (the model answer is shown next to each question) and release the full
  result.
- For papers with long formulas or drawings (Physics, Chemistry, Maths, Biology), upload the PDF
  instead and add an **answer sheet** for the multiple choice part (see below).

Urdu and other right-to-left text works everywhere. Pictures are added in the preview with
**+ Add a picture to question N**; the app makes them small before uploading (at most 20 pictures).

## JSON

The same paper as JSON. `type` is optional (questions with `options` are multiple choice), `marks`
is optional (1 mark), and `answer` is optional (a letter for multiple choice, text for written
questions). A paper without sections can use `"questions": [...]` at the top.

```json
{
  "instructions": "Answer all questions. Write clearly.",
  "sections": [
    {
      "title": "Section A: Multiple choice",
      "instructions": "Choose the best answer. Each question has 1 mark.",
      "questions": [
        {
          "type": "mcq",
          "text": "What is the SI unit of force?",
          "marks": 1,
          "options": ["Joule", "Newton", "Watt", "Pascal"],
          "answer": "b"
        },
        {
          "type": "mcq",
          "text": "Which of these is a vector quantity?",
          "marks": 1,
          "options": ["Mass", "Speed", "Velocity", "Time"],
          "answer": "c"
        }
      ]
    },
    {
      "title": "Section B: Short answers",
      "questions": [
        {
          "type": "written",
          "text": "State Newton's first law of motion.",
          "marks": 3,
          "answer": "An object stays at rest, or keeps moving in a straight line at the same speed, unless a force acts on it."
        }
      ]
    }
  ]
}
```

## Limits

At most 200 questions and 20 sections; 2 to 6 options per multiple choice question; up to 100
marks per question in whole or half marks; question text up to 2,000 characters and options up to
500 characters.

## Answer sheets for PDF tests

A PDF test can get an **answer sheet** on its **Answer sheet** page: for example 20 multiple choice
questions with options A–D and 1 mark each, then 5 written questions with 4 marks each. Students
see the PDF and tap their multiple choice answers on the sheet. Type the correct answers as letters
in order, for example `BCADB...` (use `?` to skip one).

## How it is stored (for developers)

The app turns both formats into one `Paper` (sections → questions with ids `q1`, `q2`, …, kind,
text, marks, options, picture number) and a separate `AnswerKey` (`{ "q1": { "option": 1 } }`).
Both are checked by the same rules in `shared/src/paper-rules.ts` in the browser and on the server
(D44). The text and JSON readers live in `web/src/features/teacher/paper/`.
