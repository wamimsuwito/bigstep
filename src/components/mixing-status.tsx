
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MixingStatusProps {
  activityLog: string[];
  countdownTime: number;
  initialCountdownTime: number;
  onMixingTimeChange: (time: number) => void;
  onInitialMixingTimeChange: (time: number) => void;
  isProcessing: boolean;
}

export default function MixingStatus({ 
  activityLog,
  countdownTime,
  initialCountdownTime,
  onMixingTimeChange,
  onInitialMixingTimeChange,
  isProcessing 
}: MixingStatusProps) {
  
  const progress = initialCountdownTime > 0 ? (countdownTime / initialCountdownTime) * 100 : 0;
  const logColors = ["text-green-400", "text-blue-400", "text-amber-400"];

  const handleTimeChange = (amount: number) => {
    if (!isProcessing) {
        const newTime = Math.max(0, initialCountdownTime + amount);
        onInitialMixingTimeChange(newTime);
        onMixingTimeChange(newTime);
    }
  };

  const displayTime = countdownTime;
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeWidth = 8;

  return (
    <Card className="h-full">
      <CardContent className="p-4 flex flex-col gap-4 h-full">
        <div className="flex items-center justify-around gap-4">
          {/* Circular Progress Section */}
          <div className="relative w-32 h-32 flex items-center justify-center">
             <svg className="absolute w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="hsl(var(--secondary))"
                strokeWidth={strokeWidth}
                fill="transparent"
              />
              <circle
                cx="50"
                cy="50"
                r={radius}
                stroke="hsl(var(--primary))"
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress / 100)}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s linear' }}
              />
            </svg>
            <span className="text-4xl font-mono font-bold text-foreground z-10">{displayTime}</span>
          </div>

          {/* Waktu Mixing Section */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-semibold tracking-widest text-muted-foreground">WAKTU MIXING</span>
            <div className="flex items-center gap-1 bg-background rounded-md border border-input p-1">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleTimeChange(-1)} disabled={isProcessing}>
                <ChevronDown className="h-4 w-4" />
              </Button>
              <span className="font-mono text-base font-bold w-10 text-center">{initialCountdownTime}s</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleTimeChange(1)} disabled={isProcessing}>
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Aktivitas Berjalan Section */}
        <div className="text-left flex-1 flex flex-col">
            <h3 className="text-xs font-semibold tracking-widest text-muted-foreground text-center mb-2">STATUS AKTIVITAS</h3>
             <div className="text-xs bg-muted/50 p-2 rounded-md h-40 flex flex-col-reverse justify-start font-mono overflow-y-auto">
                {activityLog.map((log, index) => (
                    <p key={index} className={cn("truncate", logColors[index % logColors.length])}>{log}</p>
                ))}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
