import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { createProfile, getProfiles } from "../../lib/api/client";

interface ProfilesPanelProps {
  accessToken: string;
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
}

export function ProfilesPanel({ accessToken, selectedProfileId, onSelectProfile }: ProfilesPanelProps) {
  const queryClient = useQueryClient();
  const [profileName, setProfileName] = useState("");
  const [partnerName, setPartnerName] = useState("");

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(accessToken)
  });

  const createProfileMutation = useMutation({
    mutationFn: () => createProfile(accessToken, { profileName, partnerName: partnerName || undefined }),
    onSuccess: async () => {
      setProfileName("");
      setPartnerName("");
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
    }
  });

  const profiles = useMemo(() => profilesQuery.data?.profiles ?? [], [profilesQuery.data]);

  useEffect(() => {
    if (!selectedProfileId && profiles.length > 0) {
      onSelectProfile(profiles[0]._id);
    }
  }, [selectedProfileId, profiles, onSelectProfile]);

  return (
    <Card title="Profiles" subtitle="Create and switch relationship contexts">
      <div>
        {profiles.map((profile) => (
          <div className="profile-item" key={profile._id}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{profile.profileName}</strong>
                {profile.partnerName ? <span className="helper"> with {profile.partnerName}</span> : null}
              </div>
              <div className="row">
                {selectedProfileId === profile._id ? <Badge>Selected</Badge> : null}
                <Button variant="soft" onClick={() => onSelectProfile(profile._id)}>
                  Use
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <hr style={{ borderColor: "var(--line)", opacity: 0.5 }} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          createProfileMutation.mutate();
        }}
      >
        <label htmlFor="profileName">Profile name</label>
        <input
          id="profileName"
          value={profileName}
          onChange={(event) => setProfileName(event.target.value)}
          required
        />

        <label htmlFor="partnerName" style={{ marginTop: 8 }}>
          Partner name (optional)
        </label>
        <input
          id="partnerName"
          value={partnerName}
          onChange={(event) => setPartnerName(event.target.value)}
        />

        <div style={{ marginTop: 10 }}>
          <Button type="submit" disabled={createProfileMutation.isPending}>
            Create profile
          </Button>
        </div>
      </form>
    </Card>
  );
}
