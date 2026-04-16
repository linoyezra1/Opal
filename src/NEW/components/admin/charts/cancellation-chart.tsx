'use client'

import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Legend,
  Cell,
  Pie,
  PieChart,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

// Opal Brand Colors
const OPAL_BLUE = '#1A365D'
const OPAL_GOLD = '#C5A059'
const RED_CANCEL = '#DC2626'
const RED_CANCEL_LIGHT = '#FCA5A5'
const AMBER_WARNING = '#F59E0B'

// Monthly cancellation data
const monthlyCancellationData = [
  { month: 'ינואר', cancellations: 12, newSubscribers: 45, churnRate: 1.3 },
  { month: 'פברואר', cancellations: 8, newSubscribers: 52, churnRate: 0.9 },
  { month: 'מרץ', cancellations: 15, newSubscribers: 68, churnRate: 1.5 },
  { month: 'אפריל', cancellations: 10, newSubscribers: 55, churnRate: 1.0 },
  { month: 'מאי', cancellations: 7, newSubscribers: 72, churnRate: 0.7 },
  { month: 'יוני', cancellations: 18, newSubscribers: 48, churnRate: 1.7 },
  { month: 'יולי', cancellations: 14, newSubscribers: 82, churnRate: 1.3 },
  { month: 'אוגוסט', cancellations: 9, newSubscribers: 78, churnRate: 0.8 },
  { month: 'ספטמבר', cancellations: 11, newSubscribers: 65, churnRate: 0.9 },
  { month: 'אוקטובר', cancellations: 6, newSubscribers: 58, churnRate: 0.5 },
  { month: 'נובמבר', cancellations: 13, newSubscribers: 71, churnRate: 1.0 },
  { month: 'דצמבר', cancellations: 8, newSubscribers: 62, churnRate: 0.6 },
]

// Cancellation reasons
const cancellationReasons = [
  { reason: 'מחיר', count: 45, percentage: 35 },
  { reason: 'חוסר שימוש', count: 32, percentage: 25 },
  { reason: 'שירות לא מספק', count: 26, percentage: 20 },
  { reason: 'מעבר למתחרה', count: 15, percentage: 12 },
  { reason: 'סיבות אישיות', count: 10, percentage: 8 },
]

const PIE_COLORS = [RED_CANCEL, AMBER_WARNING, OPAL_BLUE, OPAL_GOLD, '#6B7280']

const chartConfig = {
  cancellations: {
    label: 'ביטולים',
    color: RED_CANCEL,
  },
  newSubscribers: {
    label: 'מנויים חדשים',
    color: OPAL_BLUE,
  },
  churnRate: {
    label: 'אחוז נטישה',
    color: AMBER_WARNING,
  },
}

export function CancellationChart() {
  // Calculate totals and trends
  const totalCancellations = monthlyCancellationData.reduce((sum, m) => sum + m.cancellations, 0)
  const totalNewSubscribers = monthlyCancellationData.reduce((sum, m) => sum + m.newSubscribers, 0)
  const avgChurnRate = (monthlyCancellationData.reduce((sum, m) => sum + m.churnRate, 0) / monthlyCancellationData.length).toFixed(1)
  
  const currentMonth = monthlyCancellationData[monthlyCancellationData.length - 1]
  const previousMonth = monthlyCancellationData[monthlyCancellationData.length - 2]
  const cancellationTrend = ((currentMonth.cancellations - previousMonth.cancellations) / previousMonth.cancellations * 100).toFixed(1)
  const isCancellationDown = Number(cancellationTrend) <= 0

  const netGrowth = totalNewSubscribers - totalCancellations

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">ניתוח ביטולים</CardTitle>
            <CardDescription>מעקב אחר ביטולים ונטישת לקוחות</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Badge 
              variant="outline" 
              className={isCancellationDown 
                ? 'border-green-200 bg-green-50 text-green-700' 
                : 'border-red-200 bg-red-50 text-red-700'
              }
            >
              {isCancellationDown ? (
                <TrendingDown className="size-3 me-1" />
              ) : (
                <TrendingUp className="size-3 me-1" />
              )}
              {Math.abs(Number(cancellationTrend))}% 
              {isCancellationDown ? ' ירידה' : ' עלייה'}
            </Badge>
          </div>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: RED_CANCEL }}>{totalCancellations}</p>
            <p className="text-xs text-muted-foreground">סה״כ ביטולים</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: OPAL_BLUE }}>{totalNewSubscribers}</p>
            <p className="text-xs text-muted-foreground">מנויים חדשים</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">+{netGrowth}</p>
            <p className="text-xs text-muted-foreground">גידול נטו</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold" style={{ color: AMBER_WARNING }}>{avgChurnRate}%</p>
            <p className="text-xs text-muted-foreground">נטישה ממוצעת</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="trend">מגמה חודשית</TabsTrigger>
            <TabsTrigger value="comparison">השוואה</TabsTrigger>
            <TabsTrigger value="reasons">סיבות ביטול</TabsTrigger>
          </TabsList>

          <TabsContent value="trend">
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={monthlyCancellationData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    yAxisId="left"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cancellations"
                    name="ביטולים"
                    stroke={RED_CANCEL}
                    strokeWidth={2}
                    dot={{ fill: RED_CANCEL, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="churnRate"
                    name="אחוז נטישה"
                    stroke={AMBER_WARNING}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: AMBER_WARNING, strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </TabsContent>

          <TabsContent value="comparison">
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyCancellationData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar 
                    dataKey="newSubscribers" 
                    name="מנויים חדשים" 
                    fill={OPAL_BLUE}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="cancellations" 
                    name="ביטולים" 
                    fill={RED_CANCEL}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </TabsContent>

          <TabsContent value="reasons">
            <div className="grid grid-cols-2 gap-6">
              {/* Pie Chart */}
              <ChartContainer config={chartConfig} className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={cancellationReasons}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="reason"
                      label={({ reason, percentage }) => `${percentage}%`}
                      labelLine={false}
                    >
                      {cancellationReasons.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      content={
                        <ChartTooltipContent 
                          formatter={(value, name) => (
                            <span>{value} ביטולים</span>
                          )}
                        />
                      } 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>

              {/* Legend List */}
              <div className="flex flex-col justify-center space-y-3">
                {cancellationReasons.map((item, index) => (
                  <div key={item.reason} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="size-3 rounded-sm" 
                        style={{ backgroundColor: PIE_COLORS[index] }}
                      />
                      <span className="text-sm">{item.reason}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{item.count}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.percentage}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
