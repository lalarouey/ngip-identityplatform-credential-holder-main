import { VerifiableCredential } from '@veramo/core';
import CreateCredential from 'components/CreateCredential';
import Credentials from 'components/Credentials';
import Topbar from 'components/Topbar';
import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { TRegistryVC } from 'types';

interface CredentialDashboardProps {
  // socket: Socket;
  vcList: VerifiableCredential[];
  registryList: TRegistryVC[];
}

export function CredentialDashboard({
  // socket,
  vcList,
  registryList,
}: CredentialDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState('credentials');

  const renderComponent = () => {
    if (!socket.connected) {
      return;
    }
    switch (activeSubTab) {
      case 'credentials':
        return (
          <Credentials
            socket={socket}
            vcList={vcList}
            registryList={registryList}
          />
        );
      case 'createCredential':
        return <CreateCredential socket={socket} />;
      default:
        'credentialRequests';
    }
  };

  return (
    <div>
      <Topbar
        subTabs={['credentials', 'createCredential']}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
      />
      {renderComponent()}
    </div>
  );
}
