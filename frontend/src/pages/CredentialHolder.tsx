import { notifications } from "@mantine/notifications";
import { VerifiableCredential } from "@veramo/core";
import Challenge from "components/Challenge";
import MyPage from "components/MyPage";
import RequestCredential from "components/RequestCredential";
import { RequestService } from "components/RequestService";
import Sidebar from "components/Sidebar";
import { useCallback, useEffect, useState } from "react";
import { TRegistryVC, TSchema } from "types";
import { CredentialDashboard } from "./CredentialDashboard";

export default function CredentialHolder() {
  const [vcList, setVcList] = useState<VerifiableCredential[]>([]);
  const [registryList, setRegistryList] = useState<TRegistryVC[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [serviceStatus, setServiceStatus] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "credentials"
    | "requestCredential"
    | "challenge"
    | "requestService"
    | "myPage"
    | null
  >(null);
  const [schemaNames, setSchemaNames] = useState<string[] | null>(null);
  const [schema, setSchema] = useState<TSchema | null>(null);
  const [challenges, setChallengeList] = useState<
    { did: string; challenge: string }[]
  >([]);
  const [dids, setDids] = useState<string[]>([]);
  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  function resetSchema() {
    setSchemaNames(null);
    setSchema(null);
  }

  const connect = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3002/identifiers");
      const data = await res.json();

      setDids(data.holderDIDs);
      setEthAddress(data.ethAddress);
      setBalance(data.balance);

      setConnected(true);
      setActiveTab("credentials");

      notifications.show({
        message: "Connected to identity service",
        color: "green",
      });

      // Fetch Credentials
      const credsRes = await fetch("http://localhost:3002/credentials");
      const credsData = await credsRes.json();
      setVcList(credsData.ipfsData || []);
    } catch (err) {
      console.error(err);
      notifications.show({
        title: "Connection Error",
        message: "Unable to connect to backend",
        color: "red",
      });
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setActiveTab(null);
    notifications.show({
      message: "Disconnected",
      color: "red",
    });
  }, []);

  function renderComponent() {
    if (!connected) return null;
    switch (activeTab) {
      case "credentials":
        return (
          <CredentialDashboard vcList={vcList} registryList={registryList}  dids={dids}/>
        );
      case "requestCredential":
        return (
          <RequestCredential
            schemaNames={schemaNames}
            schema={schema}
            resetSchema={resetSchema}
            credentials={vcList}
          />
        );
      case "challenge":
        return (
          <Challenge
            challengeList={challenges}
            setChallengeList={setChallengeList}
          />
        );
      case "requestService":
        return (
          <RequestService
            vcList={vcList}
            serviceStatus={serviceStatus}
            setServiceStatus={setServiceStatus}
          />
        );
      case "myPage":
        return <MyPage ethAddress={ethAddress} dids={dids} balance={balance} />;
      default:
        return null;
    }
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "row",
      }}
    >
      <Sidebar
        activeTab={activeTab}
        connected={connected}
        setActiveTab={setActiveTab}
        connectSocket={connect}
        disconnectSocket={disconnect}
      />
      <div
        style={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          padding: "0px",
          margin: 0,
          overflowY: "auto", // Allow scrolling for large content
        }}
      >
        {connected && renderComponent()}
      </div>
    </div>
  );
}
