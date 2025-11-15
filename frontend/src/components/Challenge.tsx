import { Button, Card, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";

export default function Challenge({
  challengeList,
  setChallengeList,
}: {
  challengeList: { did: string; challenge: string }[];
  setChallengeList: React.Dispatch<
    React.SetStateAction<{ did: string; challenge: string }[]>
  >;
}) {
  const handleChallenge = async (
    challenge: { did: string; challenge: string },
    response: boolean
  ) => {
    try {
      const res = await fetch(
        "http://localhost:3002/ownership-challenge-response",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            did: challenge.did,
            challenge: challenge.challenge,
            response,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Request failed");
      }

      notifications.show({
        message: `Challenge ${response ? "accepted" : "rejected"}`,
        color: response ? "green" : "red",
      });
      setChallengeList((prev) =>
        prev?.filter(
          (entry) =>
            entry.did !== challenge.did &&
            entry.challenge !== challenge.challenge
        )
      );
    } catch (error) {
      console.error(error);
      notifications.show({
        title: "Error",
        message: "Failed to send challenge response",
        color: "red",
      });
    }
  };

  return (
    <div>
      <h2>Challenge</h2>
      <div>
        {challengeList?.map((entry, index) => (
          <Card key={index} shadow="sm" padding="lg" radius="md" withBorder>
            <Text fw={500} size="lg" mb="sm">
              Challenge from: {entry.did}
            </Text>
            <Text mb="md">Challenge phrase: {entry.challenge}</Text>
            <Group justify="space-between" mt="md">
              <Button
                color="green"
                onClick={() => handleChallenge(entry, true)}
              >
                Accept
              </Button>
              <Button color="red" onClick={() => handleChallenge(entry, false)}>
                Reject
              </Button>
            </Group>
          </Card>
        ))}
      </div>
    </div>
  );
}
