import { NavLink } from '@mantine/core';

interface TopbarProps {
  subTabs: string[] | null;
  activeSubTab: string | null;
  setActiveSubTab: React.Dispatch<React.SetStateAction<string>> | null;
}

export default function Topbar({
  subTabs,
  activeSubTab,
  setActiveSubTab,
}: TopbarProps) {
  const BACKGROUND_COLOR = '#1e3a8a';
  const ACTIVE_SUB_TAB_COLOR = '#2563eb';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0',
        margin: 0,
        backgroundColor: BACKGROUND_COLOR,
        height: '60px',
        borderBottom: '1px solid #ffffff',
      }}
    >
      {subTabs && activeSubTab && setActiveSubTab
        ? subTabs.map((subTab, i) => {
            const formattedLabel = subTab
              .replace(/([a-z])([A-Z])/g, '$1 $2') // Convert camelCase to space-separated
              .replace(/^./, str => str.toUpperCase()); // Capitalize first letter

            return (
              <NavLink
                key={i}
                label={formattedLabel}
                color={
                  activeSubTab === subTab
                    ? ACTIVE_SUB_TAB_COLOR
                    : BACKGROUND_COLOR
                }
                active
                variant='filled'
                onClick={() => setActiveSubTab(subTab)}
                style={{
                  height: '59px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  borderRight: '1px solid lightblue',
                }}
              />
            );
          })
        : null}
    </div>
  );
}
