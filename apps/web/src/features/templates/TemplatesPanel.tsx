import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { createTemplate, getTemplates } from "../../lib/api/client";

interface TemplatesPanelProps {
  accessToken: string;
  profileId: string | null;
}

export function TemplatesPanel({ accessToken, profileId }: TemplatesPanelProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("custom");
  const [baseIntervalDays, setBaseIntervalDays] = useState(7);
  const [jitterPct, setJitterPct] = useState(0.2);

  const templatesQuery = useQuery({
    queryKey: ["templates", profileId],
    queryFn: () => getTemplates(accessToken, profileId as string),
    enabled: Boolean(profileId)
  });

  const createTemplateMutation = useMutation({
    mutationFn: () =>
      createTemplate(accessToken, profileId as string, {
        name,
        category,
        baseIntervalDays,
        jitterPct,
        enabled: true
      }),
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["templates", profileId] });
    }
  });

  const templates = useMemo(() => templatesQuery.data?.templates ?? [], [templatesQuery.data]);

  return (
    <Card title="Reward Templates" subtitle="Default and custom event types">
      {!profileId ? <p className="helper">Select a profile to manage templates.</p> : null}
      {profileId ? (
        <>
          {templates.map((template) => (
            <div className="template-item" key={template._id}>
              <strong>{template.name}</strong>
              <div className="helper">
                Category: {template.category} | Base interval: {template.baseIntervalDays}d | Jitter:
                {Math.round(template.jitterPct * 100)}%
              </div>
            </div>
          ))}

          <hr style={{ borderColor: "var(--line)", opacity: 0.5 }} />
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createTemplateMutation.mutate();
            }}
          >
            <label htmlFor="templateName">Template name</label>
            <input
              id="templateName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />

            <label htmlFor="templateCategory" style={{ marginTop: 8 }}>
              Category
            </label>
            <input
              id="templateCategory"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              required
            />

            <div className="row" style={{ marginTop: 8 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="intervalDays">Base interval days</label>
                <input
                  id="intervalDays"
                  type="number"
                  min={1}
                  max={365}
                  value={baseIntervalDays}
                  onChange={(event) => setBaseIntervalDays(Number(event.target.value))}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label htmlFor="jitterPct">Jitter pct</label>
                <input
                  id="jitterPct"
                  type="number"
                  min={0}
                  max={0.9}
                  step={0.05}
                  value={jitterPct}
                  onChange={(event) => setJitterPct(Number(event.target.value))}
                />
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <Button type="submit" disabled={createTemplateMutation.isPending}>
                Create template
              </Button>
            </div>
          </form>
        </>
      ) : null}
    </Card>
  );
}
