import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";

interface EventSetListItem {
  category: string;
  name: string;
  upcomingCount: number;
  totalCount: number;
}

interface EventSetListProps {
  items: EventSetListItem[];
  selectedCategory: string | null;
  onSelect: (category: string) => void;
}

export function EventSetList({ items, selectedCategory, onSelect }: EventSetListProps) {
  return (
    <div className="set-list">
      <div className="set-list-header">
        <h3>Event Sets</h3>
        <p className="helper">One set per category</p>
      </div>

      {items.length === 0 ? <p className="helper">No sets yet. Add one in the editor.</p> : null}

      {items.map((item) => {
        const isSelected = item.category === selectedCategory;
        return (
          <Button
            key={item.category}
            variant={isSelected ? "primary" : "soft"}
            className="set-list-item"
            onClick={() => onSelect(item.category)}
          >
            <span className="set-list-title">{item.name}</span>
            <span className="set-list-subtitle">{item.category}</span>
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
