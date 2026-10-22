import { Link } from 'react-router';
import { Page, PageText } from '../../components/Page';

export function NotFoundPage() {
  return (
    <Page title="Page not found">
      <PageText>Check the link and try again.</PageText>
      <Link to="/">Go to home</Link>
    </Page>
  );
}
