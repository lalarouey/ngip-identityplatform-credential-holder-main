import { Button, Container, Indicator, NavLink } from '@mantine/core';
import { useEffect } from 'react';

export default function Sidebar({
  activeTab,
  setActiveTab,
  connected,
  connectSocket,
  disconnectSocket,
}: {
  activeTab:
    | 'credentials'
    | 'requestCredential'
    | 'challenge'
    | 'requestService'
    | 'myPage'
    | null;
  setActiveTab: React.Dispatch<
    React.SetStateAction<
      | 'credentials'
      | 'requestCredential'
      | 'challenge'
      | 'requestService'
      | 'myPage'
      | null
    >
  >;
  connected: boolean;
  connectSocket: () => void;
  disconnectSocket: () => void;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    // Trigger a re-render when the socket changes
  }, [connected]);

  const BACKGROUND_COLOR = '#1e3a8a'; // Sidebar background color
  const ACTIVE_TAB_COLOR = '#2563eb'; // Active tab color

  return (
    <Container
      style={{
        backgroundColor: '#1e3a8a', // Sidebar color
        padding: '0px', // Padding for sidebar content
        margin: 0, // Remove margin
        height: '100vh', // Full height of the viewport
        display: 'flex', // Use flexbox for layout
        flexDirection: 'column', // Stack items vertically
        width: '200px', // Fixed width for sidebar
      }}
    >
      <Container
        style={{
          padding: '10px',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: BACKGROUND_COLOR,
          height: '60px',
          borderBottom: '1px solid #ffffff',
          width: '100%',
        }}
      >
        <Button
          style={{
            backgroundColor: connected ? 'red' : 'white',
            color: connected ? '#ffffff' : 'black',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
          }}
          onClick={connected ? disconnectSocket : connectSocket}
        >
          {connected ? 'Disconnect Socket' : 'Connect Socket'}
        </Button> 
        <Indicator color={connected ? 'green' : 'red'} />
      </Container>
      <Container
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '0px',
          width: '100%',
        }}
      >
        <NavLink
          label='Credentials'
          color={
            activeTab == 'credentials' ? ACTIVE_TAB_COLOR : BACKGROUND_COLOR
          }
          active
          variant='filled'
          onClick={() => setActiveTab('credentials')}
          disabled={!connected}
          style={{
            height: '50px',
          }}
        />
        <NavLink
          label='Request Credential'
          color={
            activeTab == 'requestCredential'
              ? ACTIVE_TAB_COLOR
              : BACKGROUND_COLOR
          }
          active
          variant='filled'
          onClick={() => setActiveTab('requestCredential')}
          disabled={!connected}
          style={{
            height: '50px',
          }}
        />
        <NavLink
          label='Challenge'
          color={activeTab == 'challenge' ? ACTIVE_TAB_COLOR : BACKGROUND_COLOR}
          active
          variant='filled'
          onClick={() => setActiveTab('challenge')}
          disabled={!connected}
          style={{
            height: '50px',
          }}
        />
        <NavLink
          label='Request Service'
          color={
            activeTab == 'requestService' ? ACTIVE_TAB_COLOR : BACKGROUND_COLOR
          }
          active
          variant='filled'
          onClick={() => setActiveTab('requestService')}
          disabled={!connected}
          style={{
            height: '50px',
          }}
        />
        <NavLink
          label='My Page'
          color={activeTab == 'myPage' ? ACTIVE_TAB_COLOR : BACKGROUND_COLOR}
          active
          variant='filled'
          onClick={() => setActiveTab('myPage')}
          disabled={!connected}
          style={{
            height: '50px',
          }}
        />
      </Container>
      <Container
        style={{
          padding: '12px',
          width: '100%',
        }}
      ></Container>
    </Container>
  );
}
