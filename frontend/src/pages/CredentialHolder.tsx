import { notifications } from "@mantine/notifications";
import { VerifiableCredential } from "@veramo/core";
import Challenge from "components/Challenge";
import MyPage from "components/MyPage";
import RequestCredential from "components/RequestCredential";
import { RequestService } from "components/RequestService";
import Sidebar from "components/Sidebar";
import { useCallback, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { TRegistryVC, TSchema } from "types";
import { CredentialDashboard } from "./CredentialDashboard";
import { DelegationDashboard } from "components/DelegationDashboard";

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
    | "requestService"
    | "delegation"
    | "myPage"
    | null
  >(null);
  const [schemaNames, setSchemaNames] = useState<string[] | null>(null);
  const [schema, setSchema] = useState<TSchema | null>(null);
  const [challenges, setChallengeList] = useState<
    { from: string; challenge: string }[]
  >([]);
  const [dids, setDids] = useState<string[]>([]);
  const [holderDID, setHolderDID] = useState<string | null>(null);
  const [ethAddress, setEthAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  function resetSchema() {
    setSchemaNames(null);
    setSchema(null);
  }

  const connect = useCallback(async () => {
    try {
      const res = await fetch("http://localhost:3002/identifiers");
      const data = await res.json();

      setDids(data.holderDIDs);
      setHolderDID(data.holderDIDs[0] || null); // Use first DID as default
      setEthAddress(data.ethAddress);
      setBalance(data.balance);

      // Set up Socket.IO connection
      const newSocket = io("http://localhost:3002");

      newSocket.on("connect", () => {
        console.log("Socket connected");
        // Register the holder DID with the socket
        if (data.holderDIDs && data.holderDIDs.length > 0) {
          newSocket.emit("register-did", data.holderDIDs[0]);
        }
      });

      // Listen for ownership challenges
      newSocket.on("ownership-challenge", (data: { from: string; challenge: string }) => {
        console.log("Received ownership challenge:", data);
        notifications.show({
          title: "New Ownership Challenge",
          message: `Challenge received from ${data.from}`,
          color: "blue",
        });
        setChallengeList((prev) => {
          // Check if challenge already exists
          const exists = prev.some(
            (c) => c.from === data.from && c.challenge === data.challenge
          );
          if (exists) return prev;
          return [...prev, { from: data.from, challenge: data.challenge }];
        });
      });

      newSocket.on("disconnect", () => {
        console.log("Socket disconnected");
      });

      setSocket(newSocket);
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

      // Fetch Registry List (Revocation Status)
      if (data.holderDIDs && data.holderDIDs.length > 0) {
        const registryRes = await fetch(
          `http://localhost:3002/check-revocation-status/${data.holderDIDs[0]}`
        );
        const registryData = await registryRes.json();
        setRegistryList(registryData.result || []);
      }
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
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setConnected(false);
    setActiveTab(null);
    notifications.show({
      message: "Disconnected",
      color: "red",
    });
  }, [socket]);

  function renderComponent() {
    if (!connected) return null;
    switch (activeTab) {
      case "credentials":
        return (
          <CredentialDashboard vcList={vcList} registryList={registryList} dids={dids} />
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
            holderDID={holderDID}
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
      case "delegation":
        return <DelegationDashboard dids={dids} />;
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
        {connected && (
          <div style={{ padding: '20px', borderBottom: '1px solid #eee', backgroundColor: '#f8f9fa' }}>
            <h1 style={{ margin: 0, color: '#1e3a8a' }}>Patient Portal</h1>
          </div>
        )}
        {connected && renderComponent()}
      </div>
    </div>
  );
}
