import { notifications } from '@mantine/notifications';
import { VerifiableCredential } from '@veramo/core';
import Challenge from 'components/Challenge';
import MyPage from 'components/MyPage';
import RequestCredential from 'components/RequestCredential';
import { RequestService } from 'components/RequestService';
import Sidebar from 'components/Sidebar';
import { useCallback, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { TRegistryVC, TSchema } from 'types';
import { CredentialDashboard } from './CredentialDashboard';

export default function CredentialHolder() {
  const [vcList, setVcList] = useState<VerifiableCredential[]>([]);
  const [registryList, setRegistryList] = useState<TRegistryVC[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [serviceStatus, setServiceStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | 'credentials'
    | 'requestCredential'
    | 'challenge'
    | 'requestService'
    | 'myPage'
    | null
  >(null);
  const [schemaNames, setSchemaNames] = useState<string[] | null>(null);
  const [schema, setSchema] = useState<TSchema | null>(null);
  const [challenges, setChallengeList] = useState<
    { did: string; challenge: string }[]
  >([]);
  const [did, setDid] = useState<string | null>(null);
  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  function resetSchema() {
    setSchemaNames(null);
    setSchema(null);
  }

  useEffect(() => {
    if (socket && connected) {
      socket.emit('get-credentials');
      socket.emit('check-revocation-status');
    }
  }, [connected, socket]);

  const connectSocket = useCallback(() => {
    const newSocket = io('http://localhost:3002');

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('vc-received', (VC: VerifiableCredential) => {
      setVcList(prev => [...prev, VC]);
      notifications.show({
        message: 'Credential Received',
        color: 'green',
      });
    });

    newSocket.on(
      'custom-error',
      (error: { title: string; errorMessage: string }) => {
        console.error('Error:', error);
        notifications.show({
          title: error.title,
          message: error.errorMessage,
          color: 'red',
        });
      },
    );

    newSocket.on('credentials-received', (data: VerifiableCredential[]) => {
      setVcList(data);
      notifications.show({
        message: 'Credentials have been successfully received',
        color: 'green',
      });
    });

    newSocket.on('vcs-received', (data: TRegistryVC[]) => {
      setRegistryList(data);
      notifications.show({
        message: 'Credentials have been successfully received from registry',
        color: 'green',
      });
    });

    newSocket.on(
      'service-response',
      (responseData: { approved: boolean; token: string }) => {
        if (responseData.approved) {
          notifications.show({
            message: 'Service request succeeded',
            color: 'green',
          });
          console.log('Service token: ', responseData.token); // implement what to do with token later
        } else {
          notifications.show({
            message: 'Service request rejected',
            color: 'red',
          });
        }
      },
    );

    newSocket.on('schema-names-retrieval', (schemaNames: string[] | null) => {
      setSchemaNames(schemaNames);
    });

    newSocket.on('schema-retrieval', data => {
      setSchema(data);
    });

    newSocket.on(
      'identifier-info',
      (holderDID: string, ethAddress: string, balance: number) => {
        setDid(holderDID);
        setEthAddress(ethAddress);
        setBalance(balance);
      },
    );

    newSocket.on('did-initialized', () => {
      notifications.show({
        message: 'DID has been initialized',
        color: 'green',
      });
    });

    newSocket.on('did-cleared', () => {
      notifications.show({
        message: 'DID has been cleared',
        color: 'red',
      });
    });

    newSocket.on('funds-transferred', (recipient: string) => {
      notifications.show({
        message: `Funds have been transferred to ${recipient}`,
        color: 'green',
      });
    });

    newSocket.on(
      'ownership-challenge',
      (senderDID: string, challenge: string) => {
        notifications.show({
          title: 'Ownership Challenge',
          message: `Challenge from ${senderDID}`,
          color: 'blue',
        });
        setChallengeList(prevChallenges => [
          ...prevChallenges,
          { did: senderDID, challenge },
        ]);
      },
    );

    setSocket(newSocket);
    setActiveTab('credentials');
  }, []);

  const disconnectSocket = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setConnected(false);
    }
  }, [socket]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, [disconnectSocket]);

  function renderComponent() {
    if (!socket || !socket.connected) {
      return null;
    }
    switch (activeTab) {
      case 'credentials':
        return (
          <CredentialDashboard
            socket={socket}
            vcList={vcList}
            registryList={registryList}
          />
        );
      case 'requestCredential':
        return (
          <RequestCredential
            socket={socket}
            schemaNames={schemaNames}
            schema={schema}
            resetSchema={resetSchema}
            credentials={vcList}
          />
        );
      case 'challenge':
        return (
          <Challenge
            socket={socket}
            challengeList={challenges}
            setChallengeList={setChallengeList}
          />
        );
      case 'requestService':
        return (
          <RequestService
            socket={socket}
            vcList={vcList}
            serviceStatus={serviceStatus}
            setServiceStatus={setServiceStatus}
          />
        );
      case 'myPage':
        return (
          <MyPage
            socket={socket}
            ethAddress={ethAddress}
            did={did}
            balance={balance}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        padding: 0,
        margin: 0,
        display: 'flex',
        flexDirection: 'row',
      }}
    >
      <Sidebar
        activeTab={activeTab}
        connected={connected}
        setActiveTab={setActiveTab}
        connectSocket={connectSocket}
        disconnectSocket={disconnectSocket}
      />
      <div
        style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '0px',
          margin: 0,
          overflowY: 'auto', // Allow scrolling for large content
        }}
      >
        {socket && socket.connected && renderComponent()}
      </div>
    </div>
  );
}
