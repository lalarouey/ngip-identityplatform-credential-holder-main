import { Button, Card, Group, Text } from '@mantine/core';
import { Socket } from 'socket.io-client';

export default function Challenge({
  socket,
  challengeList,
  setChallengeList,
}: {
  socket: Socket;
  challengeList: { did: string; challenge: string }[];
  setChallengeList: React.Dispatch<
    React.SetStateAction<{ did: string; challenge: string }[]>
  >;
}) {
  const handleChallenge = (
    challenge: { did: string; challenge: string },
    response: boolean,
  ) => {
    socket.emit(
      'ownership-challenge-response',
      challenge.did,
      challenge.challenge,
      response,
    );
    setChallengeList(prev =>
      prev?.filter(
        entry =>
          entry.did !== challenge.did &&
          entry.challenge !== challenge.challenge,
      ),
    );
  };

  return (
    <div>
      <h2>Challenge</h2>
      <div>
        {challengeList?.map((entry, index) => (
          <Card key={index} shadow='sm' padding='lg' radius='md' withBorder>
            <Text fw={500} size='lg' mb='sm'>
              Challenge from: {entry.did}
            </Text>
            <Text mb='md'>Challenge phrase: {entry.challenge}</Text>
            <Group justify='space-between' mt='md'>
              <Button
                color='green'
                onClick={() => handleChallenge(entry, true)}
              >
                Accept
              </Button>
              <Button color='red' onClick={() => handleChallenge(entry, false)}>
                Reject
              </Button>
            </Group>
          </Card>
        ))}
      </div>
    </div>
  );
}
