import { ButtonLink } from '../../components/Button';
import { Page, PageText } from '../../components/Page';

export function HomePage() {
  return (
    <Page title="Exam Room">
      <PageText>Students: open the test link your teacher sent you.</PageText>
      <ButtonLink to="/teacher" variant="secondary">
        Teacher login
      </ButtonLink>
    </Page>
  );
}
