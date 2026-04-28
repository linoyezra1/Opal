import React, { useState } from 'react';
import { CheckCircle2, Download, Loader2 } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { API_BASE } from '../apiBase.js';
import { Card, CardContent } from '../components/ui/card.jsx';
import { Button } from '../components/ui/button.jsx';

export default function BeneficiarySuccess() {
  const location = useLocation();
  const transactionId = String(location.state?.transactionId || '').trim();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  async function handleDownload() {
    if (!transactionId || downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const res = await fetch(`${API_BASE}/api/deals/${encodeURIComponent(transactionId)}/summary-pdf`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'שגיאה בהורדת הסיכום');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `סיכום הזמנה - רופא עד הבית - ${transactionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err.message || 'שגיאה בהורדה');
    } finally {
      setDownloading(false);
    }
  }

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
          {transactionId ? (
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={downloading}
                className="gap-2"
              >
                {downloading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                הורדת סיכום הזמנה
              </Button>
              {downloadError ? (
                <p className="text-destructive text-sm">{downloadError}</p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
