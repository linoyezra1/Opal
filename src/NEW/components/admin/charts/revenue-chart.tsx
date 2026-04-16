'use client'

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
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
import { TrendingUp, TrendingDown } from 'lucide-react'

// Opal Brand Colors
const OPAL_BLUE = '#1A365D'
const OPAL_GOLD = '#C5A059'
const OPAL_BLUE_LIGHT = '#2D4A7C'
const OPAL_GOLD_LIGHT = '#D4B76A'

// Mock data - 12 months
const monthlyRevenueData = [
  { month: 'ינואר', revenue: 42000, profit: 15200, subscribers: 890 },
  { month: 'פברואר', revenue: 48000, profit: 17800, subscribers: 920 },
  { month: 'מרץ', revenue: 51000, profit: 19100, subscribers: 985 },
  { month: 'אפריל', revenue: 55000, profit: 20500, subscribers: 1020 },
  { month: 'מאי', revenue: 62000, profit: 23400, subscribers: 1080 },
  { month: 'יוני', revenue: 58000, profit: 21200, subscribers: 1050 },
  { month: 'יולי', revenue: 67000, profit: 25800, subscribers: 1120 },
  { month: 'אוגוסט', revenue: 72000, profit: 28100, subscribers: 1180 },
  { month: 'ספטמבר', revenue: 78000, profit: 30500, subscribers: 1210 },
  { month: 'אוקטובר', revenue: 85000, profit: 33200, subscribers: 1247 },
  { month: 'נובמבר', revenue: 92000, profit: 36100, subscribers: 1290 },
  { month: 'דצמבר', revenue: 98000, profit: 38500, subscribers: 1340 },
]

// Revenue by product
const productRevenueData = [
  { product: 'רופא עד הבית', revenue: 245000 },
  { product: 'ביטוח בריאות', revenue: 189000 },
  { product: 'ביטוח סיעודי', revenue: 156000 },
  { product: 'ביטוח חיים', revenue: 98000 },
  { product: 'חבילה משפחתית', revenue: 72000 },
]

const chartConfig = {
  revenue: {
    label: 'הכנסות',
    color: OPAL_BLUE,
  },
  profit: {
    label: 'רווח נקי',
    color: OPAL_GOLD,
  },
  subscribers: {
    label: 'מנויים',
    color: OPAL_BLUE_LIGHT,
  },
}

export function RevenueChart() {
  // Calculate trends
  const currentMonth = monthlyRevenueData[monthlyRevenueData.length - 1]
  const previousMonth = monthlyRevenueData[monthlyRevenueData.length - 2]
  const revenueTrend = ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue * 100).toFixed(1)
  const profitTrend = ((currentMonth.profit - previousMonth.profit) / previousMonth.profit * 100).toFixed(1)
  const isRevenueUp = Number(revenueTrend) >= 0
  const isProfitUp = Number(profitTrend) >= 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">סקירת הכנסות</CardTitle>
            <CardDescription>ניתוח הכנסות ורווחים לאורך השנה</CardDescription>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              {isRevenueUp ? (
                <TrendingUp className="size-4 text-green-600" />
              ) : (
                <TrendingDown className="size-4 text-red-500" />
              )}
              <span className={isRevenueUp ? 'text-green-600' : 'text-red-500'}>
                {revenueTrend}%
              </span>
              <span className="text-muted-foreground">הכנסות</span>
            </div>
            <div className="flex items-center gap-1">
              {isProfitUp ? (
                <TrendingUp className="size-4 text-green-600" />
              ) : (
                <TrendingDown className="size-4 text-red-500" />
              )}
              <span className={isProfitUp ? 'text-green-600' : 'text-red-500'}>
                {profitTrend}%
              </span>
              <span className="text-muted-foreground">רווח</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="area" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="area">גרף שטח</TabsTrigger>
            <TabsTrigger value="bar">גרף עמודות</TabsTrigger>
            <TabsTrigger value="products">לפי מוצר</TabsTrigger>
          </TabsList>

          <TabsContent value="area">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyRevenueData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={OPAL_BLUE} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={OPAL_BLUE} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={OPAL_GOLD} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={OPAL_GOLD} stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                    tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}K`}
                  />
                  <ChartTooltip 
                    content={
                      <ChartTooltipContent 
                        formatter={(value, name) => (
                          <span>₪{Number(value).toLocaleString()}</span>
                        )}
                      />
                    } 
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="הכנסות"
                    stroke={OPAL_BLUE}
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    name="רווח נקי"
                    stroke={OPAL_GOLD}
                    strokeWidth={2}
                    fill="url(#profitGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </TabsContent>

          <TabsContent value="bar">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyRevenueData}
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
                    tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}K`}
                  />
                  <ChartTooltip 
                    content={
                      <ChartTooltipContent 
                        formatter={(value, name) => (
                          <span>₪{Number(value).toLocaleString()}</span>
                        )}
                      />
                    } 
                  />
                  <Legend />
                  <Bar 
                    dataKey="revenue" 
                    name="הכנסות" 
                    fill={OPAL_BLUE} 
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="profit" 
                    name="רווח נקי" 
                    fill={OPAL_GOLD} 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </TabsContent>

          <TabsContent value="products">
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={productRevenueData}
                  layout="vertical"
                  margin={{ top: 10, right: 10, left: 80, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={true} vertical={false} />
                  <XAxis 
                    type="number"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    tickFormatter={(value) => `₪${(value / 1000).toFixed(0)}K`}
                  />
                  <YAxis 
                    type="category"
                    dataKey="product"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: '#e5e7eb' }}
                    width={80}
                  />
                  <ChartTooltip 
                    content={
                      <ChartTooltipContent 
                        formatter={(value, name) => (
                          <span>₪{Number(value).toLocaleString()}</span>
                        )}
                      />
                    } 
                  />
                  <Bar 
                    dataKey="revenue" 
                    name="הכנסות" 
                    fill={OPAL_BLUE}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
