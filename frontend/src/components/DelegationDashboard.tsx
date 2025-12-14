import { Button, Card, Flex, Text, Title, TextInput, Stack, Badge, Loader, Group } from '@mantine/core';
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

interface DelegationRequest {
    id: string;
    requesterDID: string;
    scope: string;
    purpose: string;
    audience: string[];
    expiry: string;
    receivedAt: string;
}

export function DelegationDashboard({ dids }: DelegationDashboardProps) {
    const [activeTab, setActiveTab] = useState<'issue' | 'list' | 'requests'>('requests');
    const [recipientDID, setRecipientDID] = useState('');
    const [credentialName, setCredentialName] = useState('');
    const [delegations, setDelegations] = useState<IssuedDelegation[]>([]);
    const [requests, setRequests] = useState<DelegationRequest[]>([]);
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

    const fetchRequests = async () => {
        try {
            const response = await fetch(`http://localhost:3002/delegation-requests`);
            if (response.ok) {
                const data = await response.json();
                setRequests(data.requests || []);
            }
        } catch (error) {
            console.error("Error fetching requests:", error);
        }
    };

    useEffect(() => {
        if (activeTab === 'list') {
            fetchDelegations();
        } else if (activeTab === 'requests') {
            fetchRequests();
        }
    }, [activeTab, holderDID]);

    const handleIssue = async (request?: DelegationRequest) => {
        const targetDID = request ? request.requesterDID : recipientDID;

        if (!holderDID || !targetDID) {
            notifications.show({ message: "Missing required fields", color: "red" });
            return;
        }
        setLoading(true);
        try {
            const credentialData: any = {
                permissions: [{ action: "read", resourceType: request?.scope || "medical-records" }],
                purpose: request?.purpose || "continuityOfCare",
            };

            if (request?.audience) {
                credentialData.audience = request.audience;
            }

            const response = await fetch("http://localhost:3002/issue-delegation-vc", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    holderDID,
                    recipientDID: targetDID,
                    credentialData,
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
                    variant={activeTab === 'requests' ? 'filled' : 'outline'}
                    onClick={() => setActiveTab('requests')}
                >
                    Requests
                </Button>
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

            {activeTab === 'requests' && (
                <Stack>
                    {requests.length === 0 ? (
                        <Text>No pending requests.</Text>
                    ) : (
                        requests.map((req) => (
                            <Card key={req.id} withBorder padding="lg" radius="md">
                                <Title order={4} mb="xs">Request from {req.requesterDID}</Title>
                                <Text size="sm"><strong>Purpose:</strong> {req.purpose}</Text>
                                <Text size="sm"><strong>Scope:</strong> {req.scope}</Text>
                                <Text size="sm" mb="md"><strong>Audience:</strong> {Array.isArray(req.audience) ? req.audience.join(', ') : req.audience}</Text>
                                <Button onClick={() => handleIssue(req)} loading={loading}>Authorize</Button>
                            </Card>
                        ))
                    )}
                </Stack>
            )}

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
                        <Button onClick={() => handleIssue()} loading={loading}>Authorize Access</Button>
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
