import { Button, Card, Divider, Flex, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { VerifiableCredential } from "@veramo/core";
import { useEffect, useState } from "react";
import { TRegistryVC } from "types";

interface ICredentialsProps {
  vcList: VerifiableCredential[];
  registryList: TRegistryVC[];
  dids: string[];
}

interface ICredentialProps {
  vc?: VerifiableCredential;
  isRevoked?: boolean;
  refresh: () => void;
}

const API_URL = "http://localhost:3002";

const Credential = ({ vc, isRevoked, refresh }: ICredentialProps) => {
  const [verificationStatus, setVerificationStatus] = useState<string | null>(
    null
  );

  if (!vc || !vc.credentialSubject) {
    console.error("Invalid VC", vc);
    return null;
  }

  const deleteVC = async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/remove-vc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holderDID: vc.credentialSubject.id,
          credentialID: id,
        }),
      });

      if (!res.ok) throw new Error("Delete failed");

      notifications.show({ color: "green", message: "VC removed" });
      refresh();
    } catch (err) {
      console.error(err);
      notifications.show({ color: "red", message: "Failed to delete VC" });
    }
  };

  const verifyVC = async () => {
    try {
      const res = await fetch(`${API_URL}/verify-vc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: vc }),
      });

      const data = await res.json();
      const verified = data.result?.verified;

      setVerificationStatus(verified ? "Verified" : "Not Verified");

      notifications.show({
        title: "VC Verification",
        message: verified ? "VC is valid" : "VC is NOT valid",
        color: verified ? "green" : "red",
      });
    } catch (err) {
      console.error(err);
      notifications.show({ color: "red", message: "Verification error" });
    }
  };

  // useEffect(() => {
  //   const handler = (data: { id: string; verified: boolean }) => {
  //     if (data.id !== vc.id) return;
  //     setVerificationStatus(data.verified ? "Verified" : "Not Verified");
  //     notifications.show({
  //       title: "Verification Status",
  //       message: data.verified ? "Verified" : "Not Verified",
  //       color: data.verified ? "green" : "red",
  //     });
  //   };

  //   socket.on("vc-verified", handler);
  //   return () => {
  //     socket.off("vc-verified", handler);
  //   };
  // }, [socket, vc.id]);

  return (
    <Card
      shadow="md"
      padding="xl"
      radius="md"
      withBorder
      style={{
        backgroundColor: "#f8f9fa",
        borderRadius: "12px",
        padding: "20px",
      }}
    >
      <Stack align="start">
        <Title order={3} ta="left" c="black">
          {vc.type?.[1]?.replace(/([A-Z])/g, " $1").trim() ?? "Unknown Type"}
        </Title>
        <Text ta="left" c="black">
          <strong>ID:</strong> {vc.id}
        </Text>
        <Text ta="left" c="black">
          <strong>Issuance Date:</strong> {formatDate(vc.issuanceDate)}
        </Text>
        <Text ta="left" c="black">
          <strong>Expiration Date:</strong>{" "}
          {formatDate(vc.expirationDate || "")}
        </Text>
        <Text ta="left" c="black">
          <strong>Issuer DID:</strong> {(vc.issuer as { id: string }).id}
        </Text>
        <Text ta="left" c={isRevoked ? "red" : "green"}>
          <strong>Revoked:</strong> {isRevoked ? "Yes" : "No"}
        </Text>
        <Divider my="sm" />
        {Object.entries(vc.credentialSubject).map(([key, value]) => (
          <Text key={key} ta="left" c="black">
            <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong>{" "}
            {value}
          </Text>
        ))}

        {verificationStatus && (
          <Text size="sm" mt="xs">
            <strong>Status:</strong> {verificationStatus}
          </Text>
        )}
        <Flex justify="space-between" style={{ width: "100%" }}>
          <Button color="blue" onClick={verifyVC}>
            Verify
          </Button>
          <Button color="red" onClick={() => vc.id && deleteVC(vc.id)}>
            Delete
          </Button>
        </Flex>
      </Stack>
    </Card>
  );
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const Credentials = ({ vcList, registryList, dids }: ICredentialsProps) => {
  const [credentials, setCredentials] = useState(vcList);
  const [localRegistryList, setLocalRegistryList] = useState(registryList);

  useEffect(() => {
    setLocalRegistryList(registryList);
  }, [registryList]);

  const refresh = async () => {
    try {
      const res = await fetch(`${API_URL}/credentials`);
      const data = await res.json();
      setCredentials(data.ipfsData || []);

      if (dids && dids.length > 0) {
        const registryRes = await fetch(
          `${API_URL}/check-revocation-status/${dids[0]}`
        );
        const registryData = await registryRes.json();
        setLocalRegistryList(registryData.result || []);
      }

      notifications.show({ message: "Refreshed", color: "green" });
    } catch (err) {
      console.error(err);
      notifications.show({ message: "Refresh failed", color: "red" });
    }
  };

  const isRevoked = (vcID: string): boolean => {
    const match = localRegistryList.find((r) => r.vcID === vcID);
    if (!match) return true;
    return match.revoked || match.ttl * 1000 < Date.now();
  };

  return (
    <div
      style={{
        padding: "20px",
        width: "100%",
        alignItems: "center",
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        overflowY: "auto",
        flexGrow: 1, // Take up remaining space in the parent container
        height: "80vh", // Full height of the viewport
        boxSizing: "border-box", // Ensure padding is included in the height calculation
      }}
    >
      <div>
        <Button color="gray" onClick={refresh}>
          Refresh
        </Button>
      </div>
      <div
        style={{
          marginTop: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {credentials.map((vc, i) => (
          <Credential
            key={i}
            vc={vc}
            isRevoked={isRevoked(vc.id!)}
            refresh={refresh}
          />
        ))}
      </div>
    </div>
  );
};

export default Credentials;
