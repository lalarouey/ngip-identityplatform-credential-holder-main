import { VerifiableCredential } from "@veramo/core";
import CreateCredential from "components/CreateCredential";
import Credentials from "components/Credentials";
import Topbar from "components/Topbar";
import { useState } from "react";
import { TRegistryVC } from "types";

interface CredentialDashboardProps {
  vcList: VerifiableCredential[];
  registryList: TRegistryVC[];
  dids: string[];
}

export function CredentialDashboard({
  vcList,
  registryList,
  dids
}: CredentialDashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState("credentials");

  const renderComponent = () => {
    switch (activeSubTab) {
      case "credentials":
        return <Credentials vcList={vcList} registryList={registryList} />;
      case "createCredential":
        return <CreateCredential dids={dids}/>;
      default:
        "credentialRequests";
    }
  };

  return (
    <div>
      <Topbar
        subTabs={["credentials", "createCredential"]}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
      />
      {renderComponent()}
    </div>
  );
}
