import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { applyMissedOption, getMissedOptions } from "../../lib/api/client";
import { formatIsoToLocal } from "../../lib/time/format";

interface MissedRecoveryPanelProps {
  accessToken: string;
  eventId: string | null;
  profileId: string | null;
}

export function MissedRecoveryPanel({ accessToken, eventId, profileId }: MissedRecoveryPanelProps) {
  const queryClient = useQueryClient();

  const optionsQuery = useQuery({
    queryKey: ["missed-options", eventId],
    queryFn: () => getMissedOptions(accessToken, eventId as string),
    enabled: Boolean(eventId)
  });

  const applyMutation = useMutation({
    mutationFn: ({ optionId }: { optionId: string }) =>
      applyMissedOption(accessToken, eventId as string, optionId, {
        reason: "Applied via missed recovery panel"
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["missed-options", eventId] });
      await queryClient.invalidateQueries({ queryKey: ["events", profileId] });
    }
  });

  return (
    <Card title="Missed Date Recovery" subtitle="Choose ASAP or delayed suggestion when events are missed">
      {!eventId ? <p className="helper">Pick an event to load recovery options.</p> : null}
      {eventId ? (
        <>
          {(optionsQuery.data?.options ?? []).map((option) => (
            <div className="event-item" key={option.optionId}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <strong>{option.type}</strong>
                {option.recommended ? <Badge>Recommended</Badge> : null}
              </div>
              <p className="helper">Proposed: {formatIsoToLocal(option.proposedAt)}</p>
              <p className="helper">{option.rationale}</p>
              <Button
                variant="soft"
                onClick={() => applyMutation.mutate({ optionId: option.optionId })}
                disabled={applyMutation.isPending}
              >
                Apply
              </Button>
            </div>
          ))}
        </>
      ) : null}
    </Card>
  );
}
