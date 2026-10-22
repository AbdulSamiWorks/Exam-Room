import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/Button';
import { FormError } from '../../../components/FormError';
import { Page, PageText } from '../../../components/Page';
import { TextField } from '../../../components/TextField';
import { useLogin } from './use-teacher-session';
import styles from './LoginPage.module.css';

export function LoginPage() {
  const [password, setPassword] = useState('');
  const login = useLogin();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    login.mutate(password);
  }

  return (
    <Page title="Teacher login">
      <PageText>Enter the teacher password to manage tests and see results.</PageText>
      <form className={styles.loginForm} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
        />
        {login.error && <FormError>{login.error.message}</FormError>}
        <Button
          type="submit"
          size="large"
          fullWidth
          disabled={login.isPending || password.length === 0}
        >
          {login.isPending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
    </Page>
  );
}
