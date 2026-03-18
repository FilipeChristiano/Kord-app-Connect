import { cn } from "@/lib/utils";
import { CATEGORY_COLORS } from "@/data/chords";

export function CategoryBadge({ 
  category, 
  className 
}: { 
  category: string; 
  className?: string 
}) {
  const colorClass = CATEGORY_COLORS[category] || "bg-muted text-muted-foreground border-border";
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
      colorClass,
      className
    )}>
      {category}
    </span>
  );
}
