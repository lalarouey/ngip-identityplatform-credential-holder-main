import {
  Button,
  Card,
  Divider,
  Flex,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface IMyPageProps {
  socket: Socket;
  ethAddress: string | null;
  did: string | null;
  balance: number | null;
}

export default function MyPage({
  socket,
  ethAddress,
  did,
  balance,
}: IMyPageProps) {
  const [transferAddress, setTransferAddress] = useState<string>(''); // State for the input field

  function initializeDID(did: string) {
    notifications.show({
      title: 'Initializing DID',
      message: `Initializing DID: ${did}`,
      color: 'blue',
    });
    socket.emit('initialize-did', did);
  }

  function clearDID(did: string) {
    notifications.show({
      title: 'Clearing DID',
      message: `Clearing DID: ${did}`,
      color: 'red',
    });
    socket.emit('clear-did', did);
  }

  function transferFunds() {
    if (!transferAddress) {
      notifications.show({
        title: 'Validation Error',
        message: 'Please enter a valid address.',
        color: 'red',
      });
      return;
    }

    notifications.show({
      title: 'Transferring Funds',
      message: `Transferring funds to: ${transferAddress}`,
      color: 'blue',
    });
    socket.emit('transfer-funds', transferAddress);
  }

  useEffect(() => {
    if (socket) {
      socket.emit('identifier');
    }
  }, [socket]);

  return (
    <Flex
      justify='center'
      align='center'
      style={{ height: '90%', width: '100%' }} // Take up available space
    >
      <Card
        shadow='lg' // Increased shadow for better depth
        padding='xl'
        radius='lg' // More rounded corners
        withBorder
        style={{ width: '800px', height: '500px' }} // Fixed width for the card
      >
        <Title order={3} mb='m'>
          My Digital Identity
        </Title>
        <Divider mb='lg' /> {/* Increased space below the divider */}
        <Text size='m' c='dimmed' mb='xs'>
          DID:
        </Text>
        <Text w={500} mb='md'>
          {did !== null ? did : 'Could not load DID'}
        </Text>
        <Text size='m' c='dimmed' mb='xs'>
          Ethereum Address:
        </Text>
        <Text w={500} mb='md'>
          {ethAddress !== null ? ethAddress : 'Could not load Ethereum Address'}
        </Text>
        <Text size='m' c='dimmed' mb='xs'>
          Balance:
        </Text>
        <Text w={500}>
          {balance !== null ? `${balance} Eth` : 'Could not load balance'}
        </Text>
        <Flex
          justify='space-between'
          align='center'
          style={{ marginTop: '20px' }}
        >
          <TextInput
            placeholder='Enter recipient address'
            value={transferAddress}
            onChange={e => setTransferAddress(e.target.value)}
            style={{ flex: 1, marginRight: '10px' }}
          />
          <Button
            variant='outline'
            color='green'
            onClick={transferFunds}
            style={{
              width: '150px',
              height: '40px',
            }}
          >
            Transfer Funds
          </Button>
        </Flex>
        <Divider my='lg' />
        <Flex
          justify='space-between'
          align='flex-end'
          style={{ height: '100%' }}
        >
          <Button
            variant='outline'
            color='blue'
            onClick={() => {
              if (did) {
                initializeDID(did);
              }
            }}
            style={{
              width: '150px',
              height: '40px',
            }}
          >
            Initialize DID
          </Button>
          <Button
            variant='outline'
            color='red'
            onClick={() => {
              if (did) {
                clearDID(did);
              }
            }}
            style={{
              width: '150px',
              height: '40px',
            }}
          >
            Clear DID
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
}
