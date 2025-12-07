import { Button, Card, Flex, Text, Title, TextInput, Stack, Badge, Loader } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';

interface DelegationDashboardProps {
    dids: string[];
}

interface IssuedDelegation {
    vcID: string;
    holderDID: string;
    recipientDID: string;
    credentialName: string;
    issuanceDate: string;
    revoked: number;
}

export function DelegationDashboard({ dids }: DelegationDashboardProps) {
    const [activeTab, setActiveTab] = useState<'issue' | 'list'>('issue');
    const [recipientDID, setRecipientDID] = useState('');
    const [credentialName, setCredentialName] = useState('');
    const [delegations, setDelegations] = useState<IssuedDelegation[]>([]);
    const [loading, setLoading] = useState(false);

    const holderDID = dids[0];

    const fetchDelegations = async () => {
        if (!holderDID) return;
        try {
            const response = await fetch(`http://localhost:3002/issued-delegations?holderDID=${holderDID}`);
            if (response.ok) {
                const data = await response.json();
                setDelegations(data.delegations || []);
            }
        } catch (error) {
            console.error("Error fetching delegations:", error);
        }
    };

    useEffect(() => {
        if (activeTab === 'list') {
            fetchDelegations();
        }
    }, [activeTab, holderDID]);

    const handleIssue = async () => {
        if (!holderDID || !recipientDID) {
            notifications.show({ message: "Missing required fields", color: "red" });
            return;
        }
        setLoading(true);
        try {
            const response = await fetch("http://localhost:3002/issue-delegation-vc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    holderDID,
                    recipientDID,
                    credentialData: {
                        access: "read",
                        resourceType: "medical-records"
                    },
                    credentialName: credentialName || "Delegated Access"
                }),
            });

            if (response.ok) {
                notifications.show({ message: "Delegation VC issued successfully", color: "green" });
                setRecipientDID('');
                setCredentialName('');
                setActiveTab('list');
            } else {
                notifications.show({ message: "Failed to issue Delegation VC", color: "red" });
            }
        } catch (error) {
            console.error(error);
            notifications.show({ message: "Error issuing Delegation VC", color: "red" });
        } finally {
            setLoading(false);
        }
    };

    const handleRevoke = async (credentialID: string, subjectDID: string) => {
        setLoading(true);
        try {
            const response = await fetch("http://localhost:3002/revoke-delegation-vc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    issuerDID: holderDID,
                    subjectDID,
                    credentialID
                }),
            });

            if (response.ok) {
                notifications.show({ message: "Delegation revoked successfully", color: "green" });
                fetchDelegations();
            } else {
                notifications.show({ message: "Failed to revoke delegation", color: "red" });
            }
        } catch (error) {
            console.error(error);
            notifications.show({ message: "Error revoking delegation", color: "red" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '20px', width: '100%' }}>
            <Flex gap="md" mb="lg">
                <Button
                    variant={activeTab === 'issue' ? 'filled' : 'outline'}
                    onClick={() => setActiveTab('issue')}
                >
                    Authorize Doctor
                </Button>
                <Button
                    variant={activeTab === 'list' ? 'filled' : 'outline'}
                    onClick={() => setActiveTab('list')}
                >
                    Authorized Doctors
                </Button>
            </Flex>

            {activeTab === 'issue' && (
                <Card withBorder padding="lg" radius="md">
                    <Title order={3}>Authorize Doctor Access</Title>
                    <Text size="sm" mb="md">Issue a delegated credential</Text>
                    <Stack>
                        <TextInput
                            label="Recipient DID (Doctor)"
                            placeholder="did:ethr:..."
                            value={recipientDID}
                            onChange={(e) => setRecipientDID(e.currentTarget.value)}
                        />
                        <TextInput
                            label="Credential Name"
                            placeholder="e.g. Medical Record Access"
                            value={credentialName}
                            onChange={(e) => setCredentialName(e.currentTarget.value)}
                        />
                        <Button onClick={handleIssue} loading={loading}>Authorize Access</Button>
                    </Stack>
                </Card>
            )}

            {activeTab === 'list' && (
                <Stack>
                    {delegations.length === 0 ? (
                        <Text>No delegations found.</Text>
                    ) : (
                        delegations.map((del) => (
                            <Card key={del.vcID} withBorder padding="lg" radius="md">
                                <Flex justify="space-between" align="center" mb="sm">
                                    <Title order={4}>{del.credentialName || "Delegation VC"}</Title>
                                    {del.revoked ? <Badge color="red">Revoked</Badge> : <Badge color="green">Active</Badge>}
                                </Flex>
                                <Text size="sm" mb="xs"><strong>VC ID:</strong> {del.vcID}</Text>
                                <Text size="sm" mb="xs"><strong>Recipient:</strong> {del.recipientDID}</Text>
                                <Text size="sm" mb="md"><strong>Issued:</strong> {new Date(del.issuanceDate).toLocaleString()}</Text>

                                {!del.revoked && (
                                    <Button
                                        color="red"
                                        variant="outline"
                                        onClick={() => handleRevoke(del.vcID, del.recipientDID)}
                                        loading={loading}
                                    >
                                        Revoke
                                    </Button>
                                )}
                            </Card>
                        ))
                    )}
                </Stack>
            )}
        </div>
    );
}
