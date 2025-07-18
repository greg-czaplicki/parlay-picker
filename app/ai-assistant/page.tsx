'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Send, Brain, TrendingUp, Menu, X } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AnalysisData {
  playerStats?: any
  tournamentContext?: any
  parlayRecommendations?: any
  parlayStrategies?: any[]
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState<AnalysisData>({})
  const [isClient, setIsClient] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hello! I'm your AI Golf Betting Assistant. I analyze real-time tournament data, season-long SG statistics, and current odds to help you find the best betting edges. What would you like to analyze?",
        timestamp: new Date()
      }
    ])
  }, [])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          messages: messages.slice(-4) // Send last 4 messages for context
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get response')
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
      
      if (data.analysisData) {
        setAnalysisData(data.analysisData)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const quickPrompts = [
    {
      title: "Daily Round Analysis",
      subtitle: "Top 10 picks for next round",
      prompt: "Based on current tournament leaderboard, season-long SG data, and available matchups, give me your top 10 players for tomorrow's round. Include both favorites and value plays with reasoning."
    },
    {
      title: "3Ball Matchup Value", 
      subtitle: "Find edges in 3ball odds vs performance",
      prompt: "Analyze all 3ball matchups for Round 2. Show me where one player significantly outperformed their groupmates in the previous round, current odds, and which matchups offer the best value based on season SG data vs betting lines."
    },
    {
      title: "Value Hunting",
      subtitle: "Undervalued players at good odds", 
      prompt: "Find me 5 value plays for Round 2 where: 1) Player has strong season SG stats, 2) Struggled in previous round but was close, 3) Getting favorable odds compared to their true ability. Include heavy favorites if they're undervalued."
    },
    {
      title: "Fade Analysis",
      subtitle: "Regression candidates to avoid",
      prompt: "Which players should I consider fading for Round 2? Focus on: 1) Players who shot exceptional scores but have mediocre season stats, 2) Leaders who might regress, 3) Players getting short odds despite average long-term performance."
    },
    {
      title: "Quick Odds Check",
      subtitle: "Top 3 edges right now",
      prompt: "Quick analysis: Are there any obvious mispricings in today's 3ball odds compared to season SG data and recent form? Just give me the top 3 edges."
    },
    {
      title: "Parlay Builder", 
      subtitle: "Multi-player parlay construction",
      prompt: "Help me build a 3-4 player parlay for Round 2. Find players in different matchups who: 1) Have strong statistical edges, 2) Don't compete against each other, 3) Offer reasonable combined odds for the true probability."
    }
  ]

  return (
    <div className="h-screen flex flex-col bg-slate-950 w-full -m-6 lg:-m-8">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900/50 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <Brain className="h-7 w-7 text-blue-500" />
          <h1 className="text-xl md:text-2xl font-bold text-white">AI Golf Assistant</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-sm text-slate-400">
            Real-time SG data • Odds analysis • Smart picks
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Main Content - Responsive Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Chat Column - Full width on mobile, shared on desktop */}
        <div className="flex-1 flex flex-col">
          {/* Messages Area */}
          <ScrollArea className="flex-1 p-2 md:p-4">
            <div className="max-w-none lg:max-w-4xl mx-auto space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl p-3 md:p-4 shadow-lg ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800/80 text-slate-100 border border-slate-700'
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">{message.content}</p>
                    {isClient && (
                      <p className="text-xs opacity-60 mt-2 md:mt-3">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 md:p-4 flex items-center gap-3">
                    <Loader2 className="h-4 md:h-5 w-4 md:w-5 animate-spin text-blue-500" />
                    <span className="text-slate-300 text-sm md:text-base">Analyzing tournament data...</span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
          
          {/* Input Area - Fixed at bottom */}
          <div className="border-t border-slate-700 bg-slate-900/30 p-3 md:p-4">
            <div className="max-w-none lg:max-w-4xl mx-auto flex gap-2 md:gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about players, matchups, odds..."
                className="flex-1 bg-slate-800/50 border-slate-600 text-white placeholder-slate-400 h-10 md:h-12 text-sm md:text-base"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 h-10 md:h-12 px-4 md:px-6"
              >
                <Send className="h-4 md:h-5 w-4 md:w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar - Hidden on mobile, overlay on tablet, fixed on desktop */}
        <div className={`
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          fixed lg:relative top-0 right-0 h-full lg:h-auto
          w-80 border-l border-slate-700 bg-slate-900/95 lg:bg-slate-900/20 
          overflow-y-auto transition-transform duration-300 ease-in-out
          z-50 lg:z-auto
        `}>
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <h2 className="font-semibold text-white">Quick Analysis</h2>
            </div>
            
            {quickPrompts.map((prompt, index) => (
              <Button
                key={index}
                variant="ghost"
                className="w-full text-left justify-start text-slate-300 hover:bg-slate-800/50 h-auto py-3 px-3"
                onClick={() => {
                  setInput(prompt.prompt)
                  setSidebarOpen(false) // Close sidebar on mobile after selection
                }}
              >
                <div className="text-left">
                  <div className="font-medium text-white">{prompt.title}</div>
                  <div className="text-xs text-slate-400 mt-1">{prompt.subtitle}</div>
                </div>
              </Button>
            ))}

            {/* Analysis Status */}
            {Object.keys(analysisData).length > 0 && (
              <div className="mt-6 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
                <h3 className="text-sm font-medium text-white mb-2">Data Status</h3>
                <div className="space-y-1 text-xs text-slate-400">
                  {analysisData.playerStats && <div>✓ Player stats loaded</div>}
                  {analysisData.tournamentContext && <div>✓ Tournament context ready</div>}
                  {analysisData.parlayRecommendations && <div>✓ Parlay analysis complete</div>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile sidebar overlay backdrop */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  )
}