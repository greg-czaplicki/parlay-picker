import { CourseDNAVisualization } from "@/components/course-dna-visualization"

export default function CourseDNAExamplePage() {
  // Example data based on our actual analysis
  const exampleData = {
    courseName: "U.S. Open",
    playerName: "Scottie Scheffler",
    fitScore: 74,
    fitGrade: "B",
    courseDNA: {
      sg_app: 55, // Approach play is critical
      sg_arg: 28, // Around green recovery
      sg_ott: 17, // Off tee less important
      sg_putt: 0   // Putting neutralized
    },
    playerProfile: {
      sg_app: 1.331, // Very strong
      sg_ott: 0.857, // Elite
      sg_arg: 0.254, // Good
      sg_putt: 0.435 // Solid
    },
    categoryFit: {
      sg_app: { player_strength: 1.331, course_importance: 0.55, fit_contribution: 18.3 },
      sg_ott: { player_strength: 0.857, course_importance: 0.17, fit_contribution: 3.6 },
      sg_arg: { player_strength: 0.254, course_importance: 0.28, fit_contribution: 1.8 },
      sg_putt: { player_strength: 0.435, course_importance: 0.0, fit_contribution: 0.0 }
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Course DNA Analysis</h1>
        <p className="text-gray-600">
          Understanding how player skillsets match tournament requirements
        </p>
      </div>

      <CourseDNAVisualization {...exampleData} />

      <div className="mt-8 p-6 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-3">🔍 Key Insights</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <strong>U.S. Open prioritizes precision:</strong> 55% approach play + 28% short game = 83% precision-based skills
          </li>
          <li>
            <strong>Scottie's fit gap:</strong> Elite driving (+0.857) only gets 17% weight, while his good-but-not-elite putting gets 0% weight
          </li>
          <li>
            <strong>Room for improvement:</strong> Around green game (+0.254) could be stronger for a course that values it at 28%
          </li>
          <li>
            <strong>Why 74/100:</strong> His approach strength carries most of the weight, but other skills don't maximize the course demands
          </li>
        </ul>
      </div>

      <div className="mt-6 p-4 border border-orange-200 bg-orange-50 rounded-lg">
        <h3 className="font-semibold text-orange-800 mb-2">⚠️ Data Quality Note</h3>
        <p className="text-sm text-orange-700">
          Current analysis based on limited sample (10 records). For production, this would use years of historical tournament data 
          to build robust course DNA profiles.
        </p>
      </div>
    </div>
  )
} 