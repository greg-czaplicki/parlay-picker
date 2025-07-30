import { FC } from 'react';
import { Badge } from '@/components/ui/badge';
import { FilterBadge } from '@/types/matchup-filters';
import { 
  TrendingUp, 
  BarChart3, 
  Target, 
  DollarSign,
  Zap,
  Award
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MatchupBadgesProps {
  badges: FilterBadge[];
  className?: string;
}

const badgeConfig: Record<FilterBadge['type'], { icon: any; defaultColor: string }> = {
  'odds-gap': {
    icon: DollarSign,
    defaultColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  },
  'sg-mismatch': {
    icon: TrendingUp,
    defaultColor: 'bg-red-500/20 text-red-400 border-red-500/30'
  },
  'sg-leader': {
    icon: Award,
    defaultColor: 'bg-green-500/20 text-green-400 border-green-500/30'
  },
  'stat-dom': {
    icon: BarChart3,
    defaultColor: 'bg-green-500/20 text-green-400 border-green-500/30'
  },
  'putting-edge': {
    icon: Target,
    defaultColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  },
  'ball-striking': {
    icon: Zap,
    defaultColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  },
  'form': {
    icon: TrendingUp,
    defaultColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30'
  }
};

const colorMap = {
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  red: 'bg-red-500/20 text-red-400 border-red-500/30',
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
};

export const MatchupBadges: FC<MatchupBadgesProps> = ({ badges, className }) => {
  if (!badges || badges.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((badge, index) => {
        const config = badgeConfig[badge.type];
        const Icon = config.icon;
        const colorClass = badge.color ? colorMap[badge.color] : config.defaultColor;

        return (
          <Badge
            key={`${badge.type}-${index}`}
            variant="outline"
            className={cn(
              "text-xs px-2 py-0.5 flex items-center gap-1",
              colorClass
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{badge.label}</span>
            {badge.value && (
              <span className="font-mono font-semibold ml-0.5">{badge.value}</span>
            )}
          </Badge>
        );
      })}
    </div>
  );
};

// Player highlight component for matchup cards
interface PlayerHighlightProps {
  playerName: string;
  isHighlighted: boolean;
  badges?: FilterBadge[];
  className?: string;
}

export const PlayerHighlight: FC<PlayerHighlightProps> = ({ 
  playerName, 
  isHighlighted, 
  badges = [],
  className 
}) => {
  const relevantBadges = badges.filter(b => 
    ['sg-leader', 'stat-dom', 'putting-edge', 'ball-striking'].includes(b.type)
  );

  return (
    <div className={cn(
      "relative",
      isHighlighted && "font-semibold",
      className
    )}>
      {playerName}
      {isHighlighted && relevantBadges.length > 0 && (
        <div className="inline-flex ml-2 gap-1">
          {relevantBadges.map((badge, i) => {
            const Icon = badgeConfig[badge.type].icon;
            return (
              <Icon 
                key={i}
                className="h-3 w-3 text-green-400 inline" 
                title={badge.label}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};