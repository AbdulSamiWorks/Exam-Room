import { Link } from 'react-router';
import { Page, PageText } from '../../components/Page';

export function HomePage() {
  return (
    <Page title="Exam Room">
      <PageText>Students: open the test link your teacher sent you.</PageText>
      <Link to="/teacher">Teacher login</Link>
    </Page>
  );
}
