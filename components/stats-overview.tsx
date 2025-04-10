"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { TrendingUp, DollarSign, Award } from "lucide-react"

const performanceData = [
  { name: "Mon", sg: 1.2, odds: 2.5 },
  { name: "Tue", sg: 1.8, odds: 2.2 },
  { name: "Wed", sg: 1.5, odds: 2.8 },
  { name: "Thu", sg: 2.2, odds: 3.2 },
  { name: "Fri", sg: 1.9, odds: 2.9 },
  { name: "Sat", sg: 2.5, odds: 3.5 },
  { name: "Sun", sg: 2.1, odds: 3.1 },
]

const sgCategoryData = [
  { name: "Tee-to-Green", value: 2.1 },
  { name: "Approach", value: 0.8 },
  { name: "Around Green", value: 0.3 },
  { name: "Putting", value: 0.5 },
]

const matchupDistribution2Ball = [
  { name: "Value Picks", value: 65 },
  { name: "Favorites", value: 35 },
]

const matchupDistribution3Ball = [
  { name: "Value Picks", value: 72 },
  { name: "Favorites", value: 28 },
]

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))"]

export default function StatsOverview({ matchupType }: { matchupType: string }) {
  const matchupDistribution = matchupType === "2ball" ? matchupDistribution2Ball : matchupDistribution3Ball

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="data-card">
            <div className="flex justify-between items-start mb-2">
              <span className="data-label">Top Player</span>
              <TrendingUp className="text-green-400" size={20} />
            </div>
            <div className="data-value">Rory McIlroy</div>
            <div className="text-sm text-gray-400 mt-1">
              SG: <span className="highlight-value">+2.1</span>
            </div>
          </Card>

          <Card className="data-card">
            <div className="flex justify-between items-start mb-2">
              <span className="data-label">Best Value</span>
              <DollarSign className="text-yellow-400" size={20} />
            </div>
            <div className="data-value">{matchupType === "2ball" ? "Justin Thomas" : "Collin Morikawa"}</div>
            <div className="text-sm text-gray-400 mt-1">
              Value Rating: <span className="highlight-value">{matchupType === "2ball" ? "9.2" : "8.5"}</span>
            </div>
          </Card>

          <Card className="data-card">
            <div className="flex justify-between items-start mb-2">
              <span className="data-label">Parlay Potential</span>
              <Award className="text-purple-400" size={20} />
            </div>
            <div className="data-value">{matchupType === "2ball" ? "4.8x" : "5.2x"}</div>
            <div className="text-sm text-gray-400 mt-1">
              Confidence: <span className="highlight-value">High</span>
            </div>
          </Card>
        </div>

        <Card className="glass-card">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">Performance Trends</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={performanceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e1e23", borderColor: "#333" }}
                    labelStyle={{ color: "white" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sg"
                    name="Strokes Gained"
                    stroke="hsl(var(--chart-1))"
                    activeDot={{ r: 8 }}
                  />
                  <Line type="monotone" dataKey="odds" name="Odds Multiplier" stroke="hsl(var(--chart-2))" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="glass-card highlight-card">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-2">{matchupType === "2ball" ? "2-Ball" : "3-Ball"} Matchup Analysis</h2>
            <div className="flex items-center justify-center py-4">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={matchupDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {matchupDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: "#1e1e23", borderColor: "#333" }}
                      labelStyle={{ color: "white" }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="stat-pill stat-pill-purple">
                {matchupType === "2ball" ? "65% Value Picks" : "72% Value Picks"}
              </span>
              <span className="text-sm text-gray-400">Based on current odds</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">SG Categories</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sgCategoryData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis type="number" stroke="#888" />
                  <YAxis dataKey="name" type="category" stroke="#888" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e1e23", borderColor: "#333" }}
                    labelStyle={{ color: "white" }}
                  />
                  <Bar dataKey="value" name="Strokes Gained" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold mb-4">Recent Picks</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-[#1e1e23] rounded-lg">
                <div>
                  <div className="font-medium">Rory McIlroy</div>
                  <div className="text-sm text-gray-400">vs. J. Thomas, J. Rahm</div>
                </div>
                <span className="stat-pill stat-pill-green">Won</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#1e1e23] rounded-lg">
                <div>
                  <div className="font-medium">Scottie Scheffler</div>
                  <div className="text-sm text-gray-400">vs. C. Morikawa, X. Schauffele</div>
                </div>
                <span className="stat-pill stat-pill-green">Won</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-[#1e1e23] rounded-lg">
                <div>
                  <div className="font-medium">Jordan Spieth</div>
                  <div className="text-sm text-gray-400">vs. B. DeChambeau, T. Finau</div>
                </div>
                <span className="stat-pill stat-pill-yellow">Pending</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
