import { Button, Flex, Select, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { VerifiableCredential } from '@veramo/core';
import { Socket } from 'socket.io-client';

interface IRequestServiceProps {
  socket: Socket;
  vcList: VerifiableCredential[];
  serviceStatus: string | null;
  setServiceStatus: (status: string) => void;
}

export function RequestService({ socket, vcList }: IRequestServiceProps) {
  const form = useForm({
    initialValues: {
      vcId: vcList.length > 0 ? vcList[0].id || 'Unknown' : '',
      did: '',
    },
    validate: {
      vcId: (value: string) => (value ? null : 'Please select a credential'),
      did: (value: string) =>
        value ? null : 'Service Provider DID is required',
    },
  });

  const handleRequest = async (values: typeof form.values) => {
    if (!socket.connected) {
      notifications.show({
        message: 'No agent connection',
        color: 'red',
      });
      return;
    }

    const selectedVc = vcList.find(vc => vc.id === values.vcId);
    if (!selectedVc) {
      notifications.show({
        message: 'Error: No credential selected',
        color: 'red',
      });
      return;
    }

    socket.emit('request-service', values.did, selectedVc);

    notifications.show({
      message: 'Service request sent successfully',
      color: 'green',
    });
  };

  if (!vcList || vcList.length === 0) {
    return <p>No credentials available.</p>;
  }

  return (
    <div
      style={{
        padding: '10vh',
      }}
    >
      <form
        onSubmit={form.onSubmit(values => {
          handleRequest(values);
        })}
      >
        <Stack gap='md'>
          <Select
            required
            size='md'
            label='Select Credential'
            placeholder='Choose a credential'
            data={vcList.map(vc => ({
              value: vc.id || 'Unknown',
              label: vc.id || 'Unknown',
            }))}
            {...form.getInputProps('vcId')}
          />

          <TextInput
            required
            size='md'
            label='Service Provider DID'
            placeholder='did:example:0x123abc'
            {...form.getInputProps('did')}
          />
          <Flex justify='flex-end' style={{ width: '100%' }}>
            <Button size='md' type='submit'>
              Request Service
            </Button>
          </Flex>
        </Stack>
      </form>
    </div>
  );
}
