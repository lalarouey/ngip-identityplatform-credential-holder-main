import { createTheme, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import CredentialHolder from 'pages/CredentialHolder';

function App() {
  const theme = createTheme({
    fontFamily: 'Open Sans, sans-serif',
    primaryColor: 'cyan',
  });

  return (
    <MantineProvider theme={theme}>
      <Notifications />
      <CredentialHolder />
    </MantineProvider>
  );
}

export default App;
