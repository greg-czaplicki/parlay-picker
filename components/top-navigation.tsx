"use client"

import { Calendar } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function TopNavigation() {
  return (
    <div className="top-navigation">
      <div className="flex items-center">
        <span className="font-bold text-lg">PGA Championship</span>
        <span className="text-gray-400 text-sm ml-4">May 16-19, 2024</span>
      </div>
      <div className="flex items-center gap-4">
        <Tabs defaultValue="draftkings">
          <TabsList className="bg-[#2a2a35]">
            <TabsTrigger value="draftkings" className="data-[state=active]:bg-[#1aa9e1] data-[state=active]:text-white">
              DraftKings
            </TabsTrigger>
            <TabsTrigger value="fanduel" className="data-[state=active]:bg-[#1c5cff] data-[state=active]:text-white">
              FanDuel
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Calendar className="text-gray-400" size={18} />
          <span className="text-gray-400 text-sm">Tournament Week</span>
        </div>
      </div>
    </div>
  )
}
