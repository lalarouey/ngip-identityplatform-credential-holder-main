import {
  Button,
  Flex,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { VerifiableCredential } from '@veramo/core';
import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { TSchema } from 'types';

interface IRequestForm {
  socket: Socket;
  issuerDID: string;
  schema: TSchema | null;
  credentials: VerifiableCredential[] | null;
}

function RequestForm({ socket, issuerDID, schema, credentials }: IRequestForm) {
  const form = useForm({
    initialValues:
      schema?.schemaFields?.reduce((acc, field) => {
        acc[field.fieldName] = ''; // Initialize fields
        return acc;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, {} as { [key: string]: any }) || {},
    validate:
      schema?.schemaFields?.reduce((acc, field) => {
        acc[field.fieldName] = value =>
          value ? null : `${field.fieldName} is required`;
        return acc;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }, {} as { [key: string]: (value: any) => string | null }) || {},
  });

  if (!schema) {
    return <Text c='red'>Select a schema</Text>;
  }

  if (!schema.schemaFields) {
    return <Text c='red'>Schema fields not found</Text>;
  }

  const handleSubmit = (values: typeof form.values) => {
    if (!socket.connected) {
      notifications.show({
        title: 'Error',
        message: 'Socket not connected',
      });
      return;
    }

    const { selectedCredential, ...formValues } = values;

    const parsedValues = { ...formValues };
    schema.schemaFields.forEach(field => {
      if (field.type === 'number') {
        parsedValues[field.fieldName] = Number(formValues[field.fieldName]);
      }
    });

    if (schema.requiresPhysicalVerification) {
      if (!selectedCredential) {
        notifications.show({
          title: 'Error',
          message: 'Please select a credential for physical verification',
        });
        return;
      }

      const selectedCredentialObject = credentials?.find(
        credential => credential.id === selectedCredential,
      );

      socket.emit(
        'vc-request',
        issuerDID,
        schema.schemaName,
        parsedValues,
        selectedCredentialObject,
      );
    } else {
      socket.emit('vc-request', issuerDID, schema.schemaName, parsedValues);
    }

    notifications.show({
      title: 'Success',
      message: 'Credential Request sent',
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Title order={3} mb='md'>
        {schema.schemaName}
      </Title>
      <Stack gap='md'>
        {schema.schemaFields.map(field => (
          <TextInput
            required
            size='md'
            key={field.fieldName}
            label={field.fieldName}
            placeholder={`Enter ${field.fieldName}`}
            type={field.type === 'number' ? 'number' : 'text'}
            {...form.getInputProps(field.fieldName)}
          />
        ))}

        {/* Add a field for appending a credential if requiresPhysicalVerification is true */}
        {schema.requiresPhysicalVerification && (
          <>
            {credentials && (
              <Select
                label='Select Credential'
                placeholder='Choose a physically verified credential'
                data={credentials
                  .filter(credential => credential.id)
                  .map(credential => ({
                    value: credential.id as string,
                    label: credential.id as string,
                  }))}
                {...form.getInputProps('selectedCredential')}
              />
            )}
          </>
        )}

        <Flex justify='flex-end'>
          <Button type='submit' color='blue'>
            Request Credential
          </Button>
        </Flex>
      </Stack>
    </form>
  );
}

interface ISelectIssuer {
  setIssuerDID: (issuerDID: string) => void;
  issuerDID: string;
  socket: Socket;
  disabled: boolean;
}

function SelectIssuer({ setIssuerDID, socket, disabled }: ISelectIssuer) {
  const form = useForm({
    initialValues: {
      issuerDID: '',
    },
    validate: {
      issuerDID: (value: string) => (value ? null : 'Issuer DID is required'),
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    if (!socket.connected) {
      notifications.show({
        title: 'Error',
        message: 'Socket not connected',
      });
      return;
    }
    socket.emit('retrieve-schema-names', values.issuerDID);
    setIssuerDID(values.issuerDID);
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap='md'>
        <TextInput
          required
          size='md'
          label='Issuer DID'
          placeholder='Enter Issuer DID'
          disabled={disabled} // Disable the field if the next form is rendered
          {...form.getInputProps('issuerDID')}
        />
        <Flex justify='flex-end'>
          <Button type='submit' color='blue' disabled={disabled}>
            Get Available Schemas
          </Button>
        </Flex>
      </Stack>
    </form>
  );
}

interface ISelectSchema {
  issuerDID: string;
  schemaNames: string[];
  socket: Socket;
  schemaName: string;
  setSchemaName: (schemaName: string) => void;
  disabled: boolean;
}

function SelectSchema({
  issuerDID,
  schemaNames,
  socket,
  schemaName,
  setSchemaName,
  disabled,
}: ISelectSchema) {
  const handleSchemaRequest = () => {
    if (!socket.connected) {
      notifications.show({
        title: 'Error',
        message: 'Socket not connected',
      });
      return;
    }

    socket.emit('schema-retrieval', issuerDID, schemaName);
  };

  return (
    <Stack gap='md'>
      <Select
        required
        size='md'
        label='Select Schema'
        placeholder='Choose a schema'
        data={schemaNames.map(name => ({ value: name, label: name }))}
        value={schemaName}
        onChange={value => setSchemaName(value || '')}
        disabled={disabled} // Disable the field if the next form is rendered
      />
      <Flex justify='flex-end'>
        <Button onClick={handleSchemaRequest} color='blue' disabled={disabled}>
          Request Schema
        </Button>
      </Flex>
    </Stack>
  );
}

interface IRequestCredential {
  schemaNames: string[] | null;
  schema: TSchema | null;
  resetSchema: () => void;
  // socket: Socket;
  credentials: VerifiableCredential[] | null;
}

export default function RequestCredential({
  schemaNames,
  schema,
  resetSchema,
  // socket,
  credentials,
}: IRequestCredential) {
  const [schemaName, setSchemaName] = useState<string>('');
  const [issuerDID, setIssuerDID] = useState<string>('');

  function resetRequest() {
    setSchemaName('');
    setIssuerDID('');
    resetSchema();
  }

  return (
    <div style={{ padding: '10vh' }}>
      <Button onClick={resetRequest} color='red' mb='md'>
        Reset Request
      </Button>

      <SelectIssuer
        setIssuerDID={setIssuerDID}
        issuerDID={issuerDID}
        // socket={socket}
        disabled={!!schemaNames} // Disable if schemaNames are available
      />

      {schemaNames && (
        <SelectSchema
          issuerDID={issuerDID}
          schemaNames={schemaNames}
          // socket={socket}
          schemaName={schemaName}
          setSchemaName={setSchemaName}
          disabled={!!schema} // Disable if schema is available
        />
      )}

      {schema && (
        <RequestForm
          // socket={socket}
          issuerDID={issuerDID}
          schema={schema}
          credentials={credentials}
        />
      )}
    </div>
  );
}
