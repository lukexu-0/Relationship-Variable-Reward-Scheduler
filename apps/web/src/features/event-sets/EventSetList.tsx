import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

interface EventSetListItem {
  id: string;
  slug: string;
  name: string;
  upcomingCount: number;
  totalCount: number;
}

interface EventSetListProps {
  items: EventSetListItem[];
  selectedEventConfigId: string | null;
  onSelect: (eventConfigId: string) => void;
}

export function EventSetList({ items, selectedEventConfigId, onSelect }: EventSetListProps) {
  return (
    <div className="set-list">
      <p className="helper">Choose an event to manage upcoming and history items.</p>

      {items.length === 0 ? <p className="helper">No events yet. Add one in Event Builder.</p> : null}

      {items.map((item) => {
        const isSelected = item.id === selectedEventConfigId;
        return (
          <Button
            key={item.id}
            variant={isSelected ? "primary" : "soft"}
            className={`set-list-item ${isSelected ? "selected" : ""}`}
            onClick={() => onSelect(item.id)}
          >
            <span className="set-list-title">{item.name}</span>
            <span className="set-list-meta">
              <Badge variant={item.upcomingCount > 0 ? "accent" : "default"}>
                {item.upcomingCount} upcoming
              </Badge>
              <Badge>{item.totalCount} total</Badge>
            </span>
          </Button>
        );
      })}
    </div>
  );
}
