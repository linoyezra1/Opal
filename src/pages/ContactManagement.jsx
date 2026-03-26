import React from 'react';
import { Phone, Building2, RefreshCw } from 'lucide-react';
import { API_BASE } from '../apiBase.js';
import AdminPageShell from '../components/admin/AdminPageShell.jsx';
import { Button } from '../components/ui/button.jsx';
import { Input } from '../components/ui/input.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.jsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.jsx';

const TOKEN_KEY = 'opal_admin_token';

export default function ContactManagement() {
  const [token] = React.useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [privateLeads, setPrivateLeads] = React.useState([]);
  const [corporateLeads, setCorporateLeads] = React.useState([]);
  const [savingKey, setSavingKey] = React.useState('');

  async function load() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/control-panel`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'טעינה נכשלה');
      setPrivateLeads(Array.isArray(j.privateLeads) ? j.privateLeads : []);
      setCorporateLeads(Array.isArray(j.corporateLeads) ? j.corporateLeads : []);
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, [token]);

  async function updateLead(kind, leadId, patch) {
    if (!leadId) return;
    setSavingKey(`${kind}:${leadId}`);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/leads/${kind}/${encodeURIComponent(leadId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.success) throw new Error(j.error || 'שמירה נכשלה');
      if (kind === 'private') {
        setPrivateLeads((prev) => prev.map((x) => (x.id === leadId ? { ...x, ...patch } : x)));
      } else {
        setCorporateLeads((prev) => prev.map((x) => (x.id === leadId ? { ...x, ...patch } : x)));
      }
    } catch (e) {
      setError(e.message || 'שגיאה');
    } finally {
      setSavingKey('');
    }
  }

  return (
    <AdminPageShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ניהול צור קשר (Contact Management)</h1>
            <p className="text-muted-foreground">כל הלידים מהאתר ומדפי הנחיתה במקום אחד</p>
          </div>
          <Button onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 me-2 ${loading ? 'animate-spin' : ''}`} />
            רענון
          </Button>
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="size-4" />
              צור קשר — פרטיים
            </CardTitle>
            <CardDescription>טבלת לידים מלאה</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>שם</TableHead>
                    <TableHead>טלפון</TableHead>
                    <TableHead>הודעה</TableHead>
                    <TableHead>סטטוס פנייה</TableHead>
                    <TableHead>הערות</TableHead>
                    <TableHead>מקור</TableHead>
                    <TableHead>תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {privateLeads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.name || '—'}</TableCell>
                      <TableCell dir="ltr" className="text-start">{l.phone || '—'}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{l.message || '—'}</TableCell>
                      <TableCell>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={l.leadStatus || 'חדש'}
                          onChange={(e) => updateLead('private', l.id, { leadStatus: e.target.value })}
                          disabled={savingKey === `private:${l.id}`}
                        >
                          <option value="חדש">חדש</option>
                          <option value="בטיפול">בטיפול</option>
                          <option value="טופל">טופל</option>
                        </select>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <Input
                          value={l.adminNotes || ''}
                          onChange={(e) =>
                            setPrivateLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, adminNotes: e.target.value } : x)))
                          }
                          onBlur={(e) => updateLead('private', l.id, { adminNotes: e.target.value })}
                          placeholder="הערות אדמין"
                          disabled={savingKey === `private:${l.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {l.source === 'abandoned_checkout'
                          ? l.category || 'לא המשיכו לתשלום'
                          : l.source === 'landing_contact' && l.landingSlug
                            ? `דף: ${l.landingSlug}`
                            : l.source || 'site'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{l.createdAt ? new Date(l.createdAt).toLocaleString('he-IL') : '—'}</TableCell>
                    </TableRow>
                  ))}
                      {!privateLeads.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">אין רשומות</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4" />
              צור קשר — חברות (B2B)
            </CardTitle>
            <CardDescription>טבלת לידים מלאה</CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ארגון</TableHead>
                    <TableHead>איש קשר</TableHead>
                    <TableHead>טלפון</TableHead>
                    <TableHead>אימייל</TableHead>
                    <TableHead>סטטוס פנייה</TableHead>
                    <TableHead>הערות</TableHead>
                    <TableHead>תאריך</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {corporateLeads.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.organizationName || l.company?.companyName || '—'}</TableCell>
                      <TableCell>{l.contactName || l.contactPerson?.name || '—'}</TableCell>
                      <TableCell dir="ltr" className="text-start">{l.phone || l.contactPerson?.phone || '—'}</TableCell>
                      <TableCell dir="ltr" className="text-start">{l.email || l.contactPerson?.email || '—'}</TableCell>
                      <TableCell>
                        <select
                          className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={l.leadStatus || 'חדש'}
                          onChange={(e) => updateLead('corporate', l.id, { leadStatus: e.target.value })}
                          disabled={savingKey === `corporate:${l.id}`}
                        >
                          <option value="חדש">חדש</option>
                          <option value="בטיפול">בטיפול</option>
                          <option value="טופל">טופל</option>
                        </select>
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <Input
                          value={l.adminNotes || ''}
                          onChange={(e) =>
                            setCorporateLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, adminNotes: e.target.value } : x)))
                          }
                          onBlur={(e) => updateLead('corporate', l.id, { adminNotes: e.target.value })}
                          placeholder="הערות אדמין"
                          disabled={savingKey === `corporate:${l.id}`}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{l.createdAt ? new Date(l.createdAt).toLocaleString('he-IL') : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {!corporateLeads.length ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">אין רשומות</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminPageShell>
  );
}
