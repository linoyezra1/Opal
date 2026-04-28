import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card.jsx';

export default function BeneficiarySuccess() {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-xl border-primary/20 shadow-lg">
        <CardContent className="pt-10 pb-8 text-center space-y-6">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <CheckCircle2 className="size-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">הפרטים נשמרו בהצלחה, ונשלחו אליכם למייל</h1>
            <p className="text-muted-foreground text-lg">תודה שהצטרפת למשפחת אופאל</p>
          </div>
          <p className="text-sm text-muted-foreground"></p>
        </CardContent>
      </Card>
    </div>
  );
}
