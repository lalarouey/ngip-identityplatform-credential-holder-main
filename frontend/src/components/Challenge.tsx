import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";

export default function Challenge({
  challengeList,
  setChallengeList,
  holderDID,
}: {
  challengeList: { from: string; challenge: string }[];
  setChallengeList: React.Dispatch<
    React.SetStateAction<{ from: string; challenge: string }[]>
  >;
  holderDID: string | null;
}) {
  const handleChallenge = async (
    challenge: { from: string; challenge: string },
    response: boolean
  ) => {
    if (!holderDID) {
      notifications.show({
        title: "Error",
        message: "Holder DID is not available",
        color: "red",
      });
      return;
    }

    try {
      const res = await fetch(
        "http://localhost:3002/ownership-challenge-response",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            holderDID: holderDID,
            recipientDID: challenge.from, // The verifier DID who sent the challenge
            challenge: challenge.challenge,
            response: response,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Request failed");
      }

      await res.json();
      
      notifications.show({
        title: "Success",
        message: `Challenge ${response ? "accepted" : "rejected"} and sent to verifier`,
        color: response ? "green" : "orange",
      });
      
      // Remove the challenge from the list
      setChallengeList((prev) =>
        prev?.filter(
          (entry) =>
            entry.from !== challenge.from ||
            entry.challenge !== challenge.challenge
        )
      );
    } catch (error) {
      console.error("Error responding to challenge:", error);
      notifications.show({
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to send challenge response",
        color: "red",
      });
    }
  };

  return (
    <div style={{ padding: "5vh", maxWidth: "800px", margin: "0 auto" }}>
      <Title order={2} mb="lg">
        Ownership Challenges
      </Title>
      
      {!holderDID && (
        <Card shadow="sm" padding="lg" radius="md" withBorder mb="md">
          <Text c="red" fw={500}>
            Warning: Holder DID is not available. Please connect first.
          </Text>
        </Card>
      )}

      {challengeList.length === 0 ? (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text c="dimmed" ta="center">
            No pending ownership challenges
          </Text>
        </Card>
      ) : (
        <Stack gap="md">
          {challengeList.map((entry, index) => (
            <Card key={index} shadow="sm" padding="lg" radius="md" withBorder>
              <Stack gap="sm">
                <div>
                  <Text fw={500} size="sm" c="dimmed" mb={4}>
                    Verifier DID:
                  </Text>
                  <Text
                    fw={500}
                    size="md"
                    style={{
                      wordBreak: "break-all",
                      fontFamily: "monospace",
                    }}
                  >
                    {entry.from}
                  </Text>
                </div>
                <div>
                  <Text fw={500} size="sm" c="dimmed" mb={4}>
                    Challenge Phrase:
                  </Text>
                  <Text
                    size="lg"
                    style={{
                      fontFamily: "monospace",
                      backgroundColor: "#f5f5f5",
                      padding: "8px",
                      borderRadius: "4px",
                    }}
                  >
                    {entry.challenge}
                  </Text>
                </div>
                <Group justify="flex-end" mt="md">
                  <Button
                    color="red"
                    variant="outline"
                    onClick={() => handleChallenge(entry, false)}
                    disabled={!holderDID}
                  >
                    Reject
                  </Button>
                  <Button
                    color="green"
                    onClick={() => handleChallenge(entry, true)}
                    disabled={!holderDID}
                  >
                    Accept
                  </Button>
                </Group>
              </Stack>
            </Card>
          ))}
        </Stack>
      )}
    </div>
  );
}
