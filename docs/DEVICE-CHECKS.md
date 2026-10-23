# Real phone checks

Do these checks before the first real exam, and again after big changes. Tick each box. If a
step fails, write down the phone model, the browser, what you expected and what you saw (a
screenshot helps), and share it so it can be fixed.

## What you need

- The site on **HTTPS**: your Render address (`https://exam-room-....onrender.com`). Keeping the
  screen on and fullscreen only work on HTTPS, so do not use the `http://192.168...` Wi-Fi address
  for these checks.
- One teacher device (laptop or phone) logged in as the teacher.
- One **Android** phone with **Chrome** and one **iPhone** with **Safari**. Do every student step
  on both phones.
- A scanned PDF and a PDF exported from Word.

Open the site 2–3 minutes before you start: the free server sleeps after 15 minutes.

## 1. Creating tests

- [ ] Create a test from the **scanned** PDF. Every page looks right (no blank or broken pages).
- [ ] Create a test from the **Word** PDF. Every page looks right.
- [ ] A new test shows the badge **Not open** on the test list and on the test page.
- [ ] **Edit** a test before anyone starts: change the title, time limit and leave rule, and
      replace the paper. The changes show on the test page.
- [ ] After a student has started, **Edit** only lets you change the title and subject.

## 2. Opening and closing

- [ ] On a student phone, open the test link while the test is not open: it shows **Not open yet**.
- [ ] On the teacher page, tap **Open now**. Within about 5 seconds the student phone shows the start
      form by itself, without touching it.
- [ ] Tap **Set times**: opening in 2 minutes, closing in 5 minutes. The student phone shows
      "This test opens …" and turns into the start form by itself at the opening time.
- [ ] After the closing time, a **new** roll number sees **This test is closed**.
- [ ] A student who started before closing can still read every page.
- [ ] On another phone, that same student taps **I already started this test** and enters the same
      name and roll number: the test continues (this counts as one exit).

## 3. Screen stays on

- [ ] Start the test and do not touch the phone for 3 minutes (longer than the phone's own
      screen time-out). The screen stays on.
- [ ] On the teacher page that student still has **0 exits**.
- [ ] Note if the phone is in **battery saver / Low Power Mode**: the phone may still turn the
      screen off there. Write down what happened.

## 4. Reading the paper

- [ ] After starting, turn on airplane mode for a moment: every page can still be opened
      (all pages load at the start). Turn airplane mode off again.
- [ ] Pinch to zoom, double-tap to zoom, move around a zoomed page.
- [ ] **Back** and **Next** work, and "Page X of Y" is right.
- [ ] Long-press on a page: no "Save image" or "Share image" menu appears.
- [ ] Text on the screen cannot be selected or copied.

## 5. Leaving the test (with 1 allowed exit)

- [ ] Switch to another app and come back: the red warning screen shows "1 of 1". Tap **Continue**.
- [ ] Leave again: the test is **locked** and the teacher row turns red.
- [ ] Teacher taps **Unlock**: the paper opens again on the phone by itself.
- [ ] Pull down the notification shade: note if it counts as an exit (Android usually does).
- [ ] Refresh the page: it counts as an exit (this is expected).
- [ ] iPhone: there is no fullscreen in Safari (this is expected); leaving is still detected.
- [ ] The teacher row shows **Exit history** with the times and reasons.
- [ ] Make a test with **Finish the test** as the leave rule and 0 exits. Leave once: the phone
      shows **Test finished**, the teacher row says **Left · finished**, and there is no Unlock.

## 6. Finishing

- [ ] Tap **Finish**, then **Finish test**: the finished screen shows.
- [ ] Refresh the page: it still shows finished, and the paper does not come back.
- [ ] Create a 1-minute test and wait: it shows **Time up** on the phone and on the teacher page.
- [ ] Teacher taps **End test** on one student: that phone shows **Your teacher ended the test**.
- [ ] Teacher taps **End exam for everyone**: every writing phone shows the same, the test
      becomes **Closed**, and a new roll number cannot start.

## 7. Results

- [ ] **Download CSV** opens in Excel / Google Sheets with the right names (also Urdu names),
      sorted by roll number.
- [ ] **Print** shows a clean table; the browser's print preview has no buttons or header.

## 8. Theme

- [ ] Tap **☾ Dark**: the app turns black with white text. Reload the page: it stays dark and
      does not flash white.
- [ ] Tap **☀ Light** to go back. The paper itself is always white.

## 9. Removing and deleting

- [ ] Teacher taps **Remove** on a student: the row disappears. The student's phone shows
      **Test closed on this phone**; **Open the test here** lets them start again with full time.
- [ ] Teacher deletes a test: the teacher goes back to the test list, and the student link says the
      test does not exist.

## 10. Manage (classes, subjects, chapters, students)

- [ ] **Manage** → add a class, open it, add two subjects and three chapters. Move a chapter up
      and down with the arrows; the order stays after a reload.
- [ ] **Students** → **Paste a list** from a spreadsheet (roll number and name columns). The
      preview shows every student; a line without a name or a repeated roll number is explained
      with its line number.
- [ ] Add the list: the new PINs show once. **Copy all PINs** and paste them into WhatsApp; every
      line has the roll number, name and PIN.
- [ ] **Reset PIN** on one student shows one new PIN. **Delete** a class that still has students:
      the app explains why it cannot be deleted yet.
- [ ] Create a test: the class and subject can be chosen, chapters can be tapped, and the test list
      groups the test under its subject.
