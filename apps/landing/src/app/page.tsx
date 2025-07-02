'use client'

import { ArrowRight, Shield, Zap, Heart, TrendingUp, Users, Clock, Star, Play, ChevronDown, Menu, X, Code2, Database, Globe, Lock } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useState, useEffect } from 'react'

// Environment variables with fallbacks
const MAIN_APP_URL = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'https://app.moonx.farm'
const SHOW_DEMO_VIDEO = process.env.NEXT_PUBLIC_SHOW_DEMO_VIDEO === 'true'

interface MobileMenuProps {
  isOpen: boolean
  onClose: () => void
  activeSection: string
}

function MobileMenu({ isOpen, onClose, activeSection }: MobileMenuProps) {
  const navItems = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How it Works' },
    { href: '#technology', label: 'Technology' },
    { href: '#team', label: 'Team' },
    { href: '#about', label: 'About' }
  ]

  return (
    <div className={`mobile-menu ${isOpen ? 'open' : 'closed'} md:hidden`}>
      <div className="safe-area-top">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="MoonX Farm Logo"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-lg font-bold text-gradient">MoonX Farm</span>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4 space-y-4">
          {navItems.map((item) => (
            <a 
              key={item.href}
              href={item.href} 
              className={`block py-3 px-4 rounded-lg transition-colors touch-target ${
                activeSection === item.href.slice(1) 
                  ? 'text-white bg-white/10 border-l-2 border-orange-400' 
                  : 'text-gray-300 hover:text-white hover:bg-white/10'
              }`}
              onClick={onClose}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  const handleLaunchApp = () => {
    window.open(MAIN_APP_URL, '_blank', 'noopener,noreferrer')
  }

  const handleDemoClick = () => {
    if (SHOW_DEMO_VIDEO) {
      // In production, this would open a demo video modal or redirect
      console.log('Demo video feature - implementation pending')
    }
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Intersection Observer to track active section
  useEffect(() => {
    const sections = ['features', 'how-it-works', 'technology', 'team', 'about']
    
    const observerOptions = {
      rootMargin: '-20% 0px -80% 0px',
      threshold: 0
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id)
        }
      })
    }, observerOptions)

    sections.forEach((sectionId) => {
      const element = document.getElementById(sectionId)
      if (element) {
        observer.observe(element)
      }
    })

    return () => observer.disconnect()
  }, [])

  const navItems = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How it Works' },
    { href: '#technology', label: 'Technology' },
    { href: '#team', label: 'Team' },
    { href: '#about', label: 'About' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 nav-responsive bg-gray-900/95 backdrop-blur-md border-b border-white/10">
        <div className="container-responsive flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image
              src="/logo.png"
              alt="MoonX Farm Logo"
              width={32}
              height={32}
              className="rounded-lg"
              priority
            />
            <span className="text-lg sm:text-xl font-bold text-gradient">
              MoonX Farm
            </span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6 lg:space-x-8">
            {navItems.map((item) => (
              <a 
                key={item.href}
                href={item.href} 
                className={`transition-colors relative ${
                  activeSection === item.href.slice(1) 
                    ? 'text-white' 
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {item.label}
                {activeSection === item.href.slice(1) && (
                  <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-400 to-orange-300 rounded-full"></div>
                )}
              </a>
            ))}
          </div>
          
          <div className="flex items-center space-x-3">
            <Button onClick={handleLaunchApp} className="btn-jupiter hidden xs:flex">
              <span className="hidden sm:inline">Launch App</span>
              <span className="sm:hidden">Launch</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            
            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden touch-target p-2 hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} activeSection={activeSection} />

      {/* Hero Section - Add top padding to account for fixed header */}
      <section className="relative hero-spacing text-center pt-20 sm:pt-24">
        <div className="container-responsive max-w-6xl">
          {/* Background decoration - hidden on mobile for performance */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none hidden md:block">
            <div className="floating-orb w-64 md:w-80 h-64 md:h-80 bg-orange-500/20 -top-32 md:-top-40 -left-32 md:-left-40"></div>
            <div className="floating-orb w-72 md:w-96 h-72 md:h-96 bg-orange-400/15 -bottom-32 md:-bottom-40 -right-32 md:-right-40" style={{animationDelay: '1s'}}></div>
            <div className="floating-orb w-48 md:w-64 h-48 md:h-64 bg-purple-500/10 top-16 md:top-20 right-1/4" style={{animationDelay: '2s'}}></div>
          </div>

          <div className="relative z-10 space-y-6 sm:space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center px-3 py-2 sm:px-4 sm:py-2 rounded-full glass-mobile mb-4 sm:mb-8">
              <Star className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400 mr-2" />
              <span className="text-xs sm:text-sm font-medium">The Future of DEX Trading</span>
            </div>

            {/* Main headline */}
            <h1 className="heading-responsive font-bold leading-tight">
              Trade
              <span className="text-gradient"> Gasless</span>
              <br />
              With Smart Wallets
            </h1>

            {/* Subtitle */}
            <p className="body-responsive text-gray-300 max-w-4xl mx-auto leading-relaxed">
              The first multi-aggregator DEX with Account Abstraction. 
              Trade with social login, pay zero gas fees, and get the best prices across all DEXs.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-12 lg:mb-16">
              <Button 
                size="lg" 
                onClick={handleLaunchApp} 
                className="btn-jupiter text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4"
              >
                Start Trading Now
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              {SHOW_DEMO_VIDEO && (
                <Button 
                  size="lg" 
                  variant="outline" 
                  onClick={handleDemoClick}
                  className="text-base sm:text-lg px-6 sm:px-8 py-3 sm:py-4 glass-mobile hover:bg-white/20"
                >
                  <Play className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                  Watch Demo
                </Button>
              )}
            </div>

            {/* Trust signals */}
            <div className="grid-responsive-3 max-w-5xl mx-auto">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-orange-400 mb-2">$2.5M+</div>
                <div className="text-sm sm:text-base text-gray-400">Total Volume Traded</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-orange-400 mb-2">10K+</div>
                <div className="text-sm sm:text-base text-gray-400">Gasless Transactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-orange-400 mb-2">99.9%</div>
                <div className="text-sm sm:text-base text-gray-400">Uptime</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce hidden sm:block">
          <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="section-spacing bg-black/20">
        <div className="container-responsive">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="subheading-responsive font-bold mb-4 sm:mb-6">
              Why Choose 
              <span className="text-gradient"> MoonX</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-300 max-w-3xl mx-auto">
              Experience the future of DeFi trading with cutting-edge technology and user-first design
            </p>
          </div>

          <div className="grid-responsive-3">
            {/* Feature 1 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Gasless Trading</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Your first 10 trades are completely free. No gas fees, no friction - just pure trading experience.
                </p>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Social Login</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Sign in with Google, Twitter, or email. No seed phrases, no wallet downloads - onboard in seconds.
                </p>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Best Prices</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Multi-aggregator routing across LI.FI, 1inch, and Relay ensures you always get the best rates.
                </p>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">MEV Protection</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Built-in protection against MEV attacks. Your trades are shielded from front-running and sandwich attacks.
                </p>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Advanced Orders</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Set limit orders and DCA strategies. Automate your trading with smart contract execution.
                </p>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="feature-card group">
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-orange-500/20 flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Multi-Chain</h3>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Trade across Base and BSC networks. Seamless cross-chain experience with unified liquidity.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="section-spacing">
        <div className="container-responsive max-w-6xl">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="subheading-responsive font-bold mb-4 sm:mb-6">
              Get Started in 
              <span className="text-gradient"> 30 Seconds</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-300">
              The simplest onboarding experience in DeFi
            </p>
          </div>

          <div className="grid-responsive-3 relative">
            {/* Step 1 */}
            <div className="text-center relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center mx-auto mb-4 sm:mb-6 text-lg sm:text-2xl font-bold">
                1
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Connect Socially</h3>
              <p className="text-sm sm:text-base text-gray-300">
                Sign in with your Google, Twitter, or email account. No downloads required.
              </p>
              
              {/* Connector line - hidden on mobile */}
              <div className="hidden lg:block absolute top-6 sm:top-8 left-full w-full h-0.5 bg-gradient-to-r from-orange-400 to-transparent z-0"></div>
            </div>

            {/* Step 2 */}
            <div className="text-center relative">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center mx-auto mb-4 sm:mb-6 text-lg sm:text-2xl font-bold">
                2
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Smart Wallet Created</h3>
              <p className="text-sm sm:text-base text-gray-300">
                Your Account Abstraction wallet is automatically created and secured.
              </p>
              
              {/* Connector line - hidden on mobile */}
              <div className="hidden lg:block absolute top-6 sm:top-8 left-full w-full h-0.5 bg-gradient-to-r from-orange-400 to-transparent z-0"></div>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-center mx-auto mb-4 sm:mb-6 text-lg sm:text-2xl font-bold">
                3
              </div>
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Start Trading</h3>
              <p className="text-sm sm:text-base text-gray-300">
                Begin trading immediately with gasless transactions and best prices.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section id="technology" className="section-spacing bg-black/20">
        <div className="container-responsive">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="subheading-responsive font-bold mb-4 sm:mb-6">
              Built with 
              <span className="text-gradient"> Cutting-Edge Tech</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-300 max-w-3xl mx-auto">
              Enterprise-grade infrastructure powered by industry-leading technologies
            </p>
          </div>

          {/* Beautiful Architecture Flow */}
          <div className="mb-12 sm:mb-16 lg:mb-20">
            <div className="text-center mb-8 sm:mb-12">
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4">
                <span className="text-gradient">How MoonX Works</span>
              </h3>
              <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto">
                Simple, secure, and gasless trading in 4 easy steps
              </p>
            </div>
            
            {/* Simple Visual Flow */}
            <div className="max-w-5xl mx-auto">
              <div className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 backdrop-blur-sm border border-white/10 rounded-3xl p-6 sm:p-8 lg:p-12">
                {/* Flow Diagram */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  {/* Step 1 */}
                  <div className="text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-orange-500/25">
                      👤
                    </div>
                    <h4 className="text-sm sm:text-base font-bold mb-2">1. Login</h4>
                    <p className="text-xs sm:text-sm text-gray-400">Google/Twitter/Email</p>
                  </div>

                  {/* Arrow 1 */}
                  <div className="hidden sm:flex items-center justify-center">
                    <div className="w-8 h-1 bg-gradient-to-r from-orange-400 to-purple-400 rounded-full relative">
                      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-purple-400 rounded-full"></div>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-400 flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-purple-500/25">
                      🔐
                    </div>
                    <h4 className="text-sm sm:text-base font-bold mb-2">2. Smart Wallet</h4>
                    <p className="text-xs sm:text-sm text-gray-400">Account Abstraction</p>
                  </div>

                  {/* Arrow 2 */}
                  <div className="hidden sm:flex items-center justify-center">
                    <div className="w-8 h-1 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full relative">
                      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-blue-400 rounded-full"></div>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-blue-500/25">
                      🔍
                    </div>
                    <h4 className="text-sm sm:text-base font-bold mb-2">3. Best Price</h4>
                    <p className="text-xs sm:text-sm text-gray-400">Multi-Aggregator</p>
                  </div>

                  {/* Arrow 3 */}
                  <div className="hidden sm:flex items-center justify-center">
                    <div className="w-8 h-1 bg-gradient-to-r from-blue-400 to-green-400 rounded-full relative">
                      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-2 bg-green-400 rounded-full"></div>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="text-center">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500 to-green-400 flex items-center justify-center text-2xl sm:text-3xl shadow-lg shadow-green-500/25">
                      ✅
                    </div>
                    <h4 className="text-sm sm:text-base font-bold mb-2">4. Trade</h4>
                    <p className="text-xs sm:text-sm text-gray-400">Gasless & Secure</p>
                  </div>
                </div>

                {/* Technology Stack */}
                <div className="mt-8 sm:mt-12 pt-6 sm:pt-8 border-t border-white/10">
                  <h4 className="text-center text-sm sm:text-base font-bold mb-4 text-gray-300">Powered by Industry-Leading Technologies</h4>
                  <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
                    <span className="px-3 py-2 text-xs sm:text-sm bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">ZeroDev</span>
                    <span className="px-3 py-2 text-xs sm:text-sm bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">LI.FI</span>
                    <span className="px-3 py-2 text-xs sm:text-sm bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">1inch</span>
                    <span className="px-3 py-2 text-xs sm:text-sm bg-green-500/20 text-green-300 rounded-full border border-green-500/30">Base</span>
                    <span className="px-3 py-2 text-xs sm:text-sm bg-green-500/20 text-green-300 rounded-full border border-green-500/30">BSC</span>
                    <span className="px-3 py-2 text-xs sm:text-sm bg-orange-500/20 text-orange-300 rounded-full border border-orange-500/30">MEV Protection</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section id="team" className="section-spacing">
        <div className="container-responsive">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="subheading-responsive font-bold mb-4 sm:mb-6">
              Meet Our 
              <span className="text-gradient"> Expert Team</span>
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-300 max-w-3xl mx-auto">
              A diverse team of 5 seasoned professionals with deep expertise in DeFi, blockchain, and financial systems
            </p>
          </div>

          {/* Team Grid - Max 3 per row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mb-8 sm:mb-12">
            {/* Team Member 1 - Hiep Hoang */}
            <Card className="feature-card group text-center">
              <CardContent className="p-6 sm:p-8">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg shadow-orange-500/25">
                  <Image
                    src="/images/hiephoang.jpg"
                    alt="Hiep Hoang"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3">Hiep Hoang</h3>
                <p className="text-sm sm:text-base text-orange-400 mb-4 font-medium">Leader Developer</p>
                <p className="text-sm text-gray-300 leading-relaxed mb-4">
                  Software Architecture Engineering with 8 years of experience, 4 years focusing on Web3, 
                  developing and deploying large-scale systems.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="px-3 py-1 text-xs bg-orange-500/20 text-orange-300 rounded-full border border-orange-500/30">Architecture</span>
                  <span className="px-3 py-1 text-xs bg-orange-500/20 text-orange-300 rounded-full border border-orange-500/30">Web3</span>
                </div>
              </CardContent>
            </Card>

            {/* Team Member 2 - Trung Hieu */}
            <Card className="feature-card group text-center">
              <CardContent className="p-6 sm:p-8">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg shadow-purple-500/25">
                  <Image
                    src="/images/dthieu-n.png"
                    alt="Trung Hieu"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3">Trung Hieu</h3>
                <p className="text-sm sm:text-base text-purple-400 mb-4 font-medium">Senior Developer</p>
                <p className="text-sm text-gray-300 leading-relaxed mb-4">
                  Full Stack Developer with 6 years of experience, 4 years as Team Lead, 
                  specializing in system architecture design and team management.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="px-3 py-1 text-xs bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">Full Stack</span>
                  <span className="px-3 py-1 text-xs bg-purple-500/20 text-purple-300 rounded-full border border-purple-500/30">Team Lead</span>
                </div>
              </CardContent>
            </Card>

            {/* Team Member 3 - Duy Tu */}
            <Card className="feature-card group text-center">
              <CardContent className="p-6 sm:p-8">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg shadow-blue-500/25">
                  <Image
                    src="/images/duytu.jpg"
                    alt="Duy Tu"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3">Duy Tu</h3>
                <p className="text-sm sm:text-base text-blue-400 mb-4 font-medium">R&D Leader</p>
                <p className="text-sm text-gray-300 leading-relaxed mb-4">
                  Former COO at Mind Ventures Capital with 7 years of experience in Crypto. 
                  Early Contributor to Espresso, Plasma, Pharos, and more.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">R&D</span>
                  <span className="px-3 py-1 text-xs bg-blue-500/20 text-blue-300 rounded-full border border-blue-500/30">Crypto</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Second Row - 2 Members */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto mb-8 sm:mb-12">
            {/* Team Member 4 - Tuan Le */}
            <Card className="feature-card group text-center">
              <CardContent className="p-6 sm:p-8">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg shadow-green-500/25">
                  <Image
                    src="/images/saitlee.jpg"
                    alt="Tuan Le"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3">Tuan Le</h3>
                <p className="text-sm sm:text-base text-green-400 mb-4 font-medium">R&D</p>
                <p className="text-sm text-gray-300 leading-relaxed mb-4">
                  5 years of research in Cryptocurrency field, 3 years of community management, 
                  and 2 years working in Crypto Ventures.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="px-3 py-1 text-xs bg-green-500/20 text-green-300 rounded-full border border-green-500/30">Research</span>
                  <span className="px-3 py-1 text-xs bg-green-500/20 text-green-300 rounded-full border border-green-500/30">Community</span>
                </div>
              </CardContent>
            </Card>

            {/* Team Member 5 - Son Ha */}
            <Card className="feature-card group text-center">
              <CardContent className="p-6 sm:p-8">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-6 rounded-2xl overflow-hidden shadow-lg shadow-yellow-500/25">
                  <Image
                    src="/images/sonha.jpg"
                    alt="Son Ha"
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-3">Son Ha</h3>
                <p className="text-sm sm:text-base text-yellow-400 mb-4 font-medium">R&D</p>
                <p className="text-sm text-gray-300 leading-relaxed mb-4">
                  6 years of research experience in Crypto field, 2 years doing R&D for Web3 projects, 
                  and 2 years working in Crypto Ventures.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <span className="px-3 py-1 text-xs bg-yellow-500/20 text-yellow-300 rounded-full border border-yellow-500/30">Crypto R&D</span>
                  <span className="px-3 py-1 text-xs bg-yellow-500/20 text-yellow-300 rounded-full border border-yellow-500/30">Web3</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Stats */}
          <div className="grid-responsive-4 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gradient mb-2">150K+</div>
              <div className="text-xs sm:text-sm text-gray-400">Lines of Code</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gradient mb-2">5+</div>
              <div className="text-xs sm:text-sm text-gray-400">Security Audits</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gradient mb-2">24/7</div>
              <div className="text-xs sm:text-sm text-gray-400">Monitoring</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-gradient mb-2">99.9%</div>
              <div className="text-xs sm:text-sm text-gray-400">Platform Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="section-spacing bg-gradient-to-r from-orange-500/5 to-orange-400/5">
        <div className="container-responsive">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="subheading-responsive font-bold mb-4 sm:mb-6">
              Trusted by Thousands
            </h2>
            <p className="text-base sm:text-lg lg:text-xl text-gray-300">
              Join the growing community of smart traders
            </p>
          </div>

          <div className="grid-responsive-4">
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient mb-2">97%</div>
              <div className="text-sm sm:text-base text-gray-400">Completion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient mb-2">&lt;200ms</div>
              <div className="text-sm sm:text-base text-gray-400">Quote Speed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient mb-2">5+</div>
              <div className="text-sm sm:text-base text-gray-400">Supported Chains</div>
            </div>
            <div className="text-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gradient mb-2">24/7</div>
              <div className="text-sm sm:text-base text-gray-400">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section-spacing bg-gradient-to-r from-orange-500/10 to-orange-400/10">
        <div className="container-responsive max-w-5xl text-center">
          <h2 className="subheading-responsive font-bold mb-4 sm:mb-6">
            Ready to Trade Smarter?
          </h2>
          <p className="body-responsive text-gray-300 mb-8 sm:mb-12 max-w-3xl mx-auto">
            Join thousands of traders who have discovered the future of DeFi trading. 
            Your first 10 trades are on us.
          </p>
          
          <Button 
            size="lg" 
            onClick={handleLaunchApp} 
            className="btn-jupiter text-lg sm:text-xl px-8 sm:px-12 py-4 sm:py-6"
          >
            Launch MoonX App
            <ArrowRight className="ml-2 sm:ml-3 h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
          
          <p className="text-xs sm:text-sm text-gray-400 mt-4 sm:mt-6">
            No installation required • Gasless trading • Social login
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer id="about" className="section-spacing border-t border-white/10 safe-area-bottom">
        <div className="container-responsive">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div className="col-span-1 sm:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <Image
                  src="/logo.png"
                  alt="MoonX Farm Logo"
                  width={24}
                  height={24}
                  className="rounded"
                />
                <span className="text-base sm:text-lg font-bold text-gradient">
                  MoonX Farm
                </span>
              </div>
              <p className="text-sm sm:text-base text-gray-400 mb-4 max-w-md">
                The future of DeFi trading with Account Abstraction, gasless transactions, 
                and best-in-class user experience.
              </p>
            </div>
            
            <div>
              <h4 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">Product</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How it Works</a></li>
                <li><a href="#technology" className="hover:text-white transition-colors">Technology</a></li>
                <li><button onClick={handleLaunchApp} className="hover:text-white transition-colors text-left">Trading App</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-sm sm:text-base font-semibold mb-3 sm:mb-4">Company</h4>
              <ul className="space-y-2 text-xs sm:text-sm text-gray-400">
                <li><a href="#team" className="hover:text-white transition-colors">Team</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-between pt-6 sm:pt-8 border-t border-white/10 space-y-4 sm:space-y-0">
            <div className="text-xs sm:text-sm text-gray-400 text-center sm:text-left">
              © 2025 MoonX Farm. All rights reserved.
            </div>
            
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-6 text-xs sm:text-sm text-gray-400">
              <span>Built with ❤️ for DeFi</span>
              <span className="hidden sm:inline">•</span>
              <span>Powered by Account Abstraction</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
} 