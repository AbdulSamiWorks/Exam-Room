import { useParams } from 'react-router';
import { Page, PageText } from '../../components/Page';

export function StudentPage() {
  const { testCode } = useParams();

  return (
    <Page title="Test">
      <PageText>Test code: {testCode}</PageText>
    </Page>
  );
}
