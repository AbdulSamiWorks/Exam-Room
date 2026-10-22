import { useParams } from 'react-router';
import { Page, PageText } from '../../components/Page';

export function StudentPage() {
  const { code } = useParams();
  return (
    <Page title="Test">
      <PageText>Test code: {code}</PageText>
    </Page>
  );
}
