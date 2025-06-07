import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    
    const correctPassword = process.env.ALPHA_PASSWORD
    
    if (!correctPassword) {
      return NextResponse.json(
        { error: 'Server configuration error' }, 
        { status: 500 }
      )
    }
    
    if (password === correctPassword) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Invalid password' }, 
        { status: 401 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' }, 
      { status: 400 }
    )
  }
} 