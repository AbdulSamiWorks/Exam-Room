import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button, ButtonLink } from '../../components/Button';
import { FormError } from '../../components/FormError';
import { LoadingScreen } from '../../components/LoadingScreen';
import { Page, PageText } from '../../components/Page';
import { SelectField } from '../../components/SelectField';
import { TextField } from '../../components/TextField';
import { ThemeToggle } from '../../components/ThemeToggle';
import { studentLimits } from '../../lib/student-limits';
import { safeNextPath } from './student-paths';
import { useLoginClasses, useStudentLogin, useStudentSession } from './use-student-account';
import styles from './StudentLoginPage.module.css';

export function StudentLoginPage() {
  const [searchParams] = useSearchParams();
  const nextPath = safeNextPath(searchParams);
  const session = useStudentSession();

  if (session.isPending) return <LoadingScreen />;
  if (session.data) return <Navigate to={nextPath} replace />;

  return (
    <Page title="Student login" actions={<ThemeToggle />}>
      <PageText>Use the roll number and the PIN your teacher gave you.</PageText>
      <LoginForm nextPath={nextPath} />
    </Page>
  );
}

function LoginForm({ nextPath }: { nextPath: string }) {
  const navigate = useNavigate();
  const classesQuery = useLoginClasses();
  const login = useStudentLogin();
  const [chosenClassId, setChosenClassId] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [pin, setPin] = useState('');

  if (classesQuery.isPending) return <LoadingScreen message="Loading classes…" />;
  if (classesQuery.isError) return <FormError>{classesQuery.error.message}</FormError>;

  const classes = classesQuery.data;
  if (classes.length === 0) {
    return <PageText>Your teacher has not added any classes yet.</PageText>;
  }
  const classId = chosenClassId || (classes.length === 1 ? String(classes[0]?.id) : '');
  const canSubmit = Boolean(classId && rollNumber.trim() && pin.trim());

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    login.mutate(
      { classId: Number(classId), rollNumber: rollNumber.trim(), pin: pin.trim() },
      { onSuccess: () => navigate(nextPath, { replace: true }) },
    );
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <SelectField
        label="Class"
        value={classId}
        onChange={(event) => setChosenClassId(event.target.value)}
      >
        <option value="">Choose your class</option>
        {classes.map((schoolClass) => (
          <option key={schoolClass.id} value={schoolClass.id}>
            {schoolClass.name}
          </option>
        ))}
      </SelectField>
      <TextField
        label="Roll number"
        autoComplete="username"
        value={rollNumber}
        maxLength={studentLimits.maxRollNumberLength}
        onChange={(event) => setRollNumber(event.target.value)}
      />
      <TextField
        label="PIN"
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        value={pin}
        maxLength={studentLimits.pinLength}
        onChange={(event) => setPin(event.target.value)}
      />
      {login.error && <FormError>{login.error.message}</FormError>}
      <Button type="submit" size="large" fullWidth disabled={!canSubmit || login.isPending}>
        {login.isPending ? 'Logging in…' : 'Log in'}
      </Button>
      <ButtonLink to="/teacher" variant="secondary" fullWidth>
        I am the teacher
      </ButtonLink>
    </form>
  );
}
