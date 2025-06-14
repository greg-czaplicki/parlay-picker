"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface PlayerCourseFitProps {
  courseName: string
  playerName: string
  fitScore: number
  fitGrade: string
  courseDNA: {
    sg_ott: number
    sg_app: number
    sg_arg: number
    sg_putt: number
  }
  playerProfile: {
    sg_ott: number
    sg_app: number
    sg_arg: number
    sg_putt: number
  }
  categoryFit: {
    sg_ott: { player_strength: number; course_importance: number; fit_contribution: number }
    sg_app: { player_strength: number; course_importance: number; fit_contribution: number }
    sg_arg: { player_strength: number; course_importance: number; fit_contribution: number }
    sg_putt: { player_strength: number; course_importance: number; fit_contribution: number }
  }
}

const SKILL_LABELS = {
  sg_ott: { name: "Off the Tee", emoji: "💪", description: "Driving distance and accuracy" },
  sg_app: { name: "Approach Play", emoji: "🎯", description: "Iron play precision to greens" },
  sg_arg: { name: "Around Green", emoji: "🏌️", description: "Short game and chipping" },
  sg_putt: { name: "Putting", emoji: "🎱", description: "Performance on the greens" }
}

const getGradeColor = (grade: string) => {
  if (grade.startsWith('A')) return 'bg-green-500'
  if (grade.startsWith('B')) return 'bg-blue-500'
  if (grade.startsWith('C')) return 'bg-yellow-500'
  return 'bg-red-500'
}

const getFitStrengthColor = (contribution: number) => {
  if (contribution > 10) return 'text-green-600 font-semibold'
  if (contribution > 5) return 'text-blue-600'
  if (contribution < 0) return 'text-red-600'
  return 'text-gray-600'
}

export function CourseDNAVisualization({
  courseName,
  playerName,
  fitScore,
  fitGrade,
  courseDNA,
  playerProfile,
  categoryFit
}: PlayerCourseFitProps) {
  // Sort categories by course importance
  const sortedCategories = Object.entries(courseDNA)
    .sort(([,a], [,b]) => b - a)
    .map(([key]) => key as keyof typeof courseDNA)

  const primarySkill = sortedCategories[0]

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🧬 {courseName} Course DNA</span>
            <Badge className={`${getGradeColor(fitGrade)} text-white`}>
              {fitScore}/100 ({fitGrade})
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Course DNA Profile */}
            <div>
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-gray-600">
                🏆 Course Skill Priority
              </h3>
              <div className="space-y-3">
                {sortedCategories.map((category, index) => {
                  const skill = SKILL_LABELS[category]
                  const percentage = courseDNA[category]
                  const isPrimary = index === 0
                  
                  return (
                    <div key={category} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className={`${isPrimary ? 'font-semibold' : ''}`}>
                          {skill.emoji} {skill.name} {isPrimary && '(PRIMARY)'}
                        </span>
                        <span className={`${isPrimary ? 'font-bold text-blue-600' : ''}`}>
                          {percentage}%
                        </span>
                      </div>
                      <Progress 
                        value={percentage} 
                        className="h-2"
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Player Profile */}
            <div>
              <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-gray-600">
                🏌️ {playerName}'s SG Profile
              </h3>
              <div className="space-y-3">
                {sortedCategories.map((category) => {
                  const skill = SKILL_LABELS[category]
                  const playerStrength = playerProfile[category]
                  const contribution = categoryFit[category].fit_contribution
                  
                  return (
                    <div key={category} className="flex items-center justify-between text-sm">
                      <span>{skill.emoji} {skill.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">
                          {playerStrength > 0 ? '+' : ''}{playerStrength.toFixed(2)}
                        </span>
                        <span className={`text-xs ${getFitStrengthColor(contribution)}`}>
                          ({contribution > 0 ? '+' : ''}{contribution.toFixed(1)})
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Fit Analysis */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-sm mb-2">📈 Fit Analysis</h4>
            <p className="text-sm text-gray-600">
              <strong>{courseName}</strong> prioritizes <strong>{SKILL_LABELS[primarySkill].name.toLowerCase()}</strong> ({courseDNA[primarySkill]}%). 
              {playerName}'s strength in this area (+{playerProfile[primarySkill].toFixed(2)} SG) contributes{' '}
              <span className={getFitStrengthColor(categoryFit[primarySkill].fit_contribution)}>
                {categoryFit[primarySkill].fit_contribution.toFixed(1)} points
              </span> to their overall fit score.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 