import {
  Button,
  Card,
  Divider,
  Flex,
  Group,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

interface IMyPageProps {
  ethAddress: string | null;
  dids: string[];
  balance: number | null;
}

export default function MyPage({ ethAddress, dids, balance }: IMyPageProps) {
  const [transferAddress, setTransferAddress] = useState<string>(""); // State for the input field

  async function initializeDID(did: string) {
    notifications.show({
      title: "Initializing DID",
      message: `Initializing DID: ${did}`,
      color: "blue",
    });
    try {
      const res = await fetch("http://localhost:3002/initialize-did", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did }),
      });

      if (!res.ok) throw new Error("Failed");

      notifications.show({
        title: "Success",
        message: `DID Initialized: ${did}`,
        color: "green",
      });
    } catch (err) {
      notifications.show({
        title: "Error",
        message: "Failed to initialize DID",
        color: "red",
      });
    }
  }

  async function clearDID(did: string) {
    notifications.show({
      title: "Clearing DID",
      message: `Clearing DID: ${did}`,
      color: "red",
    });
    try {
      const res = await fetch("http://localhost:3002/clear-did", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ did }),
      });

      if (!res.ok) throw new Error("Failed");

      notifications.show({
        title: "Success",
        message: `DID Cleared: ${did}`,
        color: "green",
      });
    } catch (err) {
      notifications.show({
        title: "Error",
        message: "Failed to clear DID",
        color: "red",
      });
    }
  }

  async function transferFunds() {
    if (!transferAddress) {
      notifications.show({
        title: "Validation Error",
        message: "Please enter a valid address.",
        color: "red",
      });
      return;
    }

    notifications.show({
      title: "Transferring Funds",
      message: `Transferring funds to: ${transferAddress}`,
      color: "blue",
    });
    try {
      const res = await fetch("http://localhost:3002/transfer-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: transferAddress }),
      });

      if (!res.ok) throw new Error("Failed");

      notifications.show({
        title: "Success",
        message: `Funds transferred to ${transferAddress}`,
        color: "green",
      });
    } catch (err) {
      notifications.show({
        title: "Error",
        message: "Failed to transfer funds",
        color: "red",
      });
    }
  }

  // useEffect(() => {
  //   if (socket) {
  //     socket.emit("identifier");
  //   }
  // }, [socket]);

  return (
    <Flex
      justify="center"
      align="center"
      style={{ height: "90%", width: "100%" }}
    >
      <Card
        shadow="lg"
        padding="xl"
        radius="lg"
        withBorder
        style={{ width: "800px", height: "500px", overflowY: "auto" }}
      >
        <Title order={3} mb="md">
          My Digital Identity
        </Title>
        <Divider mb="lg" />

        <Text size="m" c="dimmed" mb="xs">
          All DIDs:
        </Text>
        {dids.length === 0 ? (
          <Text w={500} mb="md">
            No DIDs found
          </Text>
        ) : (
          dids.map((did, index) => (
            <Flex
              key={index}
              justify="space-between"
              align="center"
              style={{
                marginBottom: "12px",
                flexWrap: "wrap", // allow long DIDs to wrap to next line
              }}
            >
              <Text
                style={{
                  wordBreak: "break-all", // ensures long DIDs don't overflow
                  flex: 1,
                  marginRight: "10px",
                }}
              >
                {did}
              </Text>

              <Group gap="xs">
                <Button
                  size="xs"
                  variant="outline"
                  color="blue"
                  onClick={() => initializeDID(did)}
                >
                  Initialize
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  color="red"
                  onClick={() => clearDID(did)}
                >
                  Clear
                </Button>
              </Group>
            </Flex>
          ))
        )}

        <Divider my="lg" />

        <Text size="m" c="dimmed" mb="xs">
          Ethereum Address:
        </Text>
        <Text w={500} mb="md">
          {ethAddress !== null ? ethAddress : "Could not load Ethereum Address"}
        </Text>

        <Text size="m" c="dimmed" mb="xs">
          Balance:
        </Text>
        <Text w={500} mb="md">
          {balance !== null ? `${balance} Eth` : "Could not load balance"}
        </Text>

        <Flex justify="space-between" align="center" mt="md">
          <TextInput
            placeholder="Enter recipient address"
            value={transferAddress}
            onChange={(e) => setTransferAddress(e.target.value)}
            style={{ flex: 1, marginRight: "10px" }}
          />
          <Button variant="outline" color="green" onClick={transferFunds}>
            Transfer Funds
          </Button>
        </Flex>
      </Card>
    </Flex>
  );

  // function initializeDID(did: string) {
  //   notifications.show({
  //     title: "Initializing DID",
  //     message: `Initializing DID: ${did}`,
  //     color: "blue",
  //   });
  //   socket.emit("initialize-did", did);
  // }

  // function clearDID(did: string) {
  //   notifications.show({
  //     title: "Clearing DID",
  //     message: `Clearing DID: ${did}`,
  //     color: "red",
  //   });
  //   socket.emit("clear-did", did);
  // }

  // function transferFunds() {
  //   if (!transferAddress) {
  //     notifications.show({
  //       title: "Validation Error",
  //       message: "Please enter a valid address.",
  //       color: "red",
  //     });
  //     return;
  //   }

  //   notifications.show({
  //     title: "Transferring Funds",
  //     message: `Transferring funds to: ${transferAddress}`,
  //     color: "blue",
  //   });
  //   socket.emit("transfer-funds", transferAddress);
  // }

  // useEffect(() => {
  //   if (socket) {
  //     socket.emit("identifier");
  //   }
  // }, [socket]);

  // return (
  //   <Flex
  //     justify="center"
  //     align="center"
  //     style={{ height: "90%", width: "100%" }} // Take up available space
  //   >
  //     <Card
  //       shadow="lg" // Increased shadow for better depth
  //       padding="xl"
  //       radius="lg" // More rounded corners
  //       withBorder
  //       style={{ width: "800px", height: "500px" }} // Fixed width for the card
  //     >
  //       <Title order={3} mb="m">
  //         My Digital Identity
  //       </Title>
  //       <Divider mb="lg" /> {/* Increased space below the divider */}
  //       <Text size="m" c="dimmed" mb="xs">
  //         All DIDs:
  //       </Text>
  //       {dids.length == 0 ? (
  //         <Text w={500} mb="md">
  //           No DIDs found
  //         </Text>
  //       ) : (
  //         dids.map((did, index) => (
  //           <Text key={index} w={500} mb="md">
  //             {did}
  //           </Text>
  //         ))
  //       )}
  //       <Text w={500} mb="md"></Text>
  //       <Text size="m" c="dimmed" mb="xs">
  //         Ethereum Address:
  //       </Text>
  //       <Text w={500} mb="md">
  //         {ethAddress !== null ? ethAddress : "Could not load Ethereum Address"}
  //       </Text>
  //       <Text size="m" c="dimmed" mb="xs">
  //         Balance:
  //       </Text>
  //       <Text w={500}>
  //         {balance !== null ? `${balance} Eth` : "Could not load balance"}
  //       </Text>
  //       <Flex
  //         justify="space-between"
  //         align="center"
  //         style={{ marginTop: "20px" }}
  //       >
  //         <TextInput
  //           placeholder="Enter recipient address"
  //           value={transferAddress}
  //           onChange={(e) => setTransferAddress(e.target.value)}
  //           style={{ flex: 1, marginRight: "10px" }}
  //         />
  //         <Button
  //           variant="outline"
  //           color="green"
  //           onClick={transferFunds}
  //           style={{
  //             width: "150px",
  //             height: "40px",
  //           }}
  //         >
  //           Transfer Funds
  //         </Button>
  //       </Flex>
  //       <Divider my="lg" />
  //       <Flex
  //         justify="space-between"
  //         align="flex-end"
  //         style={{ height: "100%" }}
  //       >
  //         <Button
  //           variant="outline"
  //           color="blue"
  //           onClick={() => {
  //             if (dids.length > 0) {
  //               initializeDID(dids[0]);
  //             }
  //           }}
  //           style={{
  //             width: "150px",
  //             height: "40px",
  //           }}
  //         >
  //           Initialize DID
  //         </Button>
  //         <Button
  //           variant="outline"
  //           color="red"
  //           onClick={() => {
  //             if (dids.length > 0) {
  //               clearDID(dids[0]);
  //             }
  //           }}
  //           style={{
  //             width: "150px",
  //             height: "40px",
  //           }}
  //         >
  //           Clear DID
  //         </Button>
  //       </Flex>
  //     </Card>
  //   </Flex>
  // );
}
