
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { Scale } from '@/lib/types';
import { Atom } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeightIndicatorProps {
  scale: Scale;
  isPouring: boolean;
}

export default function WeightIndicator({ scale, isPouring }: WeightIndicatorProps) {
  const { name, weight, unit, target = 0 } = scale;
  
  const displayWeight = weight.toFixed(0);
  const progressValue = target > 0 ? (weight / target) * 100 : 0;

  return (
    <Card>
        <CardHeader className="p-3">
            <CardTitle className="text-foreground text-center text-base font-semibold tracking-wider">{name}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
            <div className="relative aspect-video bg-muted/50 rounded-md flex flex-col items-center justify-center mb-3 overflow-hidden">
                <Progress value={progressValue} className="absolute inset-0 h-full w-full rounded-none" indicatorClassName="bg-primary/80 transition-all duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-muted/30 via-muted/10 to-transparent"></div>
                <span className={cn(
                    "text-4xl font-mono font-bold z-10 pt-4 transition-colors",
                    isPouring ? "text-destructive" : "text-foreground"
                )}>{displayWeight}</span>
                <span className={cn(
                    "text-xl font-semibold -mt-1 z-10 transition-colors",
                     isPouring ? "text-destructive/80" : "text-muted-foreground"
                )}>{unit}</span>
            </div>
            <Progress value={progressValue} className="h-1.5 bg-secondary" indicatorClassName="bg-primary"/>
            <p className="text-center text-muted-foreground mt-2 text-xs">Target: {target} {unit}</p>
        </CardContent>
    </Card>
  );
}

    
