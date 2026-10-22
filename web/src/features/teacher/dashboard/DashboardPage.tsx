import { ButtonLink } from '../../../components/Button';
import { Page, PageText } from '../../../components/Page';

export function DashboardPage() {
  return (
    <Page title="Tests" actions={<ButtonLink to="/teacher/tests/new">+ New test</ButtonLink>}>
      <PageText>Your tests will be listed here, grouped by subject.</PageText>
    </Page>
  );
}
