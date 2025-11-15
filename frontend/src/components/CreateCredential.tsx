import { Button, Flex, Select, Stack, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

interface CreateCredentialProps {
  dids: string[];
}

export default function CreateCredential({ dids }: CreateCredentialProps) {
  const [credentialName, setCredentialName] = useState<string>("");
  const [holderDID, setHolderDID] = useState<string>(dids[0] || "");
  const [values, setValues] = useState<
    { fieldName: string; type: string; value: string | number }[]
  >([{ fieldName: "", type: "string", value: "" }]);
  const API_URL = "http://localhost:3002";

  const handleAddField = () => {
    setValues([...values, { fieldName: "", type: "string", value: "" }]);
  };

  const handleRemoveField = (index: number) => {
    setValues(values.filter((_, i) => i !== index));
  };

  const handleFieldChange = (
    index: number,
    field: Partial<{ fieldName: string; type: string; value: string | number }>
  ) => {
    const updatedFields = values.map((f, i) =>
      i === index ? { ...f, ...field } : f
    );
    setValues(updatedFields);
  };

  const handleReset = () => {
    setCredentialName("");
    setValues([{ fieldName: "", type: "string", value: "" }]);
  };

  const handleSubmit = async () => {
    const invalidFields = values.filter(
      (field) =>
        !field.fieldName ||
        !field.value ||
        (field.type === "number" && isNaN(Number(field.value)))
    );

    if (!credentialName) {
      notifications.show({
        title: "Validation Error",
        message: "Credential Name is required.",
        color: "red",
      });
      return;
    }

    if (values.length === 0) {
      notifications.show({
        title: "Validation Error",
        message: "Credential must have at least one field.",
        color: "red",
      });
      return;
    }

    if (invalidFields.length > 0) {
      notifications.show({
        title: "Validation Error",
        message: "Please ensure all custom fields are filled correctly.",
        color: "red",
      });
      return;
    }

    const transformedValues = values.reduce((acc, field) => {
      acc[field.fieldName] =
        field.type === "number" ? Number(field.value) : field.value;
      return acc;
    }, {} as { [key: string]: any });

    try {
      const res = await fetch(`${API_URL}/issue-vc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holderDID,
          credentialName,
          credential: transformedValues,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        notifications.show({
          title: "Success",
          message: "VC issued successfully!",
          color: "green",
        });
        handleReset();
      } else {
        notifications.show({
          title: "Error",
          message: data.error || "Failed to issue VC",
          color: "red",
        });
      }
    } catch (err) {
      notifications.show({
        title: "Error",
        message: "Server error",
        color: "red",
      });
    }

    notifications.show({
      title: "Success",
      message: "Credential submitted successfully!",
      color: "green",
    });
  };

  return (
    <div
      style={{
        padding: "5vh",
        overflowY: "auto",
        height: "92vh",
      }}
    >
      <div style={{ maxWidth: "600px", margin: "0 auto" }}>
        <Select
          label="Select Holder DID"
          placeholder="Choose DID"
          data={dids.map((d) => ({ value: d, label: d }))}
          value={holderDID}
          onChange={(value) => setHolderDID(value || "")}
          required
          style={{ marginBottom: "20px" }}
        />
        <Button
          color="red"
          variant="outline"
          onClick={handleReset}
          style={{ marginBottom: "20px" }}
        >
          Reset
        </Button>
        <TextInput
          label="Credential Name"
          placeholder="Enter Credential Name"
          value={credentialName}
          onChange={(e) => setCredentialName(e.target.value)}
          required
          style={{ marginBottom: "20px" }}
        />
        <form>
          <Stack gap="md">
            {values.map((field, index) => (
              <Stack key={index} gap="sm">
                <Flex gap="md" align="center">
                  <TextInput
                    placeholder="Field Name"
                    value={field.fieldName}
                    onChange={(e) =>
                      handleFieldChange(index, { fieldName: e.target.value })
                    }
                    style={{ flex: 1 }}
                  />
                  <Select
                    data={[
                      { value: "string", label: "String" },
                      { value: "number", label: "Number" },
                    ]}
                    value={field.type}
                    onChange={(value) =>
                      handleFieldChange(index, { type: value || "string" })
                    }
                    style={{ flex: 1 }}
                  />
                  <Button
                    color="red"
                    variant="outline"
                    onClick={() => handleRemoveField(index)}
                  >
                    Remove
                  </Button>
                </Flex>
                <TextInput
                  placeholder="Value"
                  value={field.value}
                  type={field.type === "number" ? "number" : "text"}
                  onChange={(e) =>
                    handleFieldChange(index, {
                      value:
                        field.type === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    })
                  }
                />
              </Stack>
            ))}
            <Button variant="outline" onClick={handleAddField}>
              Add Field
            </Button>
            <Button type="button" color="blue" onClick={handleSubmit}>
              Issue Credential
            </Button>
          </Stack>
        </form>
      </div>
    </div>
  );
}
